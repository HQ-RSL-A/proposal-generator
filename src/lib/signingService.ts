import { prisma } from "@/lib/prisma";
import { blobPaths, putPrivate } from "@/lib/blob";
import { logEvent } from "@/lib/audit";
import { gateToken } from "@/lib/partyTokens";
import { createCheckoutSession, findOrCreateCustomer } from "@/lib/stripe";
import { effectiveLineItems, isSignOnly, type PaymentConfig, type TokensJson } from "@/lib/types";
import type { Proposal, SignatureType } from "@/generated/prisma/client";

export class SigningError extends Error {
  constructor(
    public code:
      | "invalid_token"
      | "expired"
      | "voided"
      | "declined"
      | "already_signed"
      | "tier_required"
      | "consent_required"
      | "bad_signature",
    message: string
  ) {
    super(message);
  }
}

export interface SignSubmission {
  rawToken: string;
  signatureType: "DRAWN" | "TYPED";
  /** data:image/png;base64,... produced client-side (canvas) */
  signaturePngDataUrl: string;
  adoptedName: string;
  signerTitle: string;
  signerCompany: string;
  fontFamily: string | null;
  esignConsent: boolean;
  selectedTierId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SignResult {
  allSigned: boolean;
  /** Stripe Checkout URL when the last signer owes a payment, else null */
  checkoutUrl: string | null;
  proposalId: string;
}

const MAX_SIGNATURE_BYTES = 500_000;

function decodeSignaturePng(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new SigningError("bad_signature", "Signature must be a PNG data URL");
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length < 100 || buffer.length > MAX_SIGNATURE_BYTES) {
    throw new SigningError("bad_signature", "Signature image size out of bounds");
  }
  // PNG magic bytes
  if (!buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new SigningError("bad_signature", "Signature is not a valid PNG");
  }
  return buffer;
}

export async function submitSignature(submission: SignSubmission): Promise<SignResult> {
  const gate = await gateToken(submission.rawToken);
  if (!gate.ok) {
    const map = {
      invalid: "invalid_token",
      expired: "expired",
      voided: "voided",
      declined: "declined",
    } as const;
    throw new SigningError(map[gate.reason], `Signing not available (${gate.reason})`);
  }
  const party = gate.party;
  const proposal = party.proposal;

  if (party.signedAt) throw new SigningError("already_signed", "You have already signed");
  if (!submission.esignConsent) {
    throw new SigningError("consent_required", "E-signature consent is required");
  }
  if (!submission.adoptedName.trim()) {
    throw new SigningError("bad_signature", "Adopted name is required");
  }
  if (!submission.signerTitle.trim() || !submission.signerCompany.trim()) {
    throw new SigningError("bad_signature", "Title and company are required");
  }

  const config = frozenPaymentConfig(proposal);
  const tiered = Boolean(config.tiers && config.tiers.length > 0);
  let tierId = proposal.selectedTierId;
  if (tiered && !tierId) {
    if (!submission.selectedTierId) {
      throw new SigningError("tier_required", "Select a pricing option before signing");
    }
    if (!config.tiers!.some((tier) => tier.id === submission.selectedTierId)) {
      throw new SigningError("tier_required", "Unknown pricing option");
    }
    tierId = submission.selectedTierId;
  }

  // Blob write happens before the transaction; the fixed path makes retries overwrite.
  const png = decodeSignaturePng(submission.signaturePngDataUrl);
  const { url: imageBlobUrl } = await putPrivate(
    blobPaths.signature(proposal.id, party.id),
    png,
    "image/png"
  );

  const now = new Date();
  const result = await prisma.$transaction(
    async (tx) => {
      // One-shot signature claim — concurrent submits lose on the row guard.
      const claimed = await tx.party.updateMany({
        where: { id: party.id, signedAt: null },
        data: { signedAt: now },
      });
      if (claimed.count === 0) {
        throw new SigningError("already_signed", "You have already signed");
      }

      await tx.signature.create({
        data: {
          proposalId: proposal.id,
          partyId: party.id,
          type: submission.signatureType as SignatureType,
          imageBlobUrl,
          adoptedName: submission.adoptedName.trim(),
          signerTitle: submission.signerTitle.trim(),
          signerCompany: submission.signerCompany.trim(),
          fontFamily: submission.fontFamily,
          esignConsented: true,
          consentedAt: now,
          signedAt: now,
          ipAddress: submission.ipAddress,
          userAgent: submission.userAgent,
        },
      });

      const remaining = await tx.party.count({
        where: { proposalId: proposal.id, role: "CLIENT_SIGNER", signedAt: null },
      });

      if (remaining > 0) {
        await tx.proposal.update({
          where: { id: proposal.id },
          data: { status: "PARTIALLY_SIGNED", selectedTierId: tierId },
        });
        return { allSigned: false };
      }

      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: "SIGNED",
          completedAt: now,
          selectedTierId: tierId,
          paymentStatus: isSignOnly(config) ? "NOT_REQUIRED" : "AWAITING",
        },
      });
      return { allSigned: true };
    },
    { isolationLevel: "Serializable" }
  );

  await logEvent({
    proposalId: proposal.id,
    partyId: party.id,
    eventType: "ESIGN_CONSENTED",
    metadata: { ipAddress: submission.ipAddress, userAgent: submission.userAgent },
  });
  await logEvent({
    proposalId: proposal.id,
    partyId: party.id,
    eventType: "PARTY_SIGNED",
    metadata: {
      method: submission.signatureType,
      adoptedName: submission.adoptedName,
      ipAddress: submission.ipAddress,
      userAgent: submission.userAgent,
      ...(tierId ? { selectedTierId: tierId } : {}),
    },
  });
  if (tierId && tierId !== proposal.selectedTierId) {
    await logEvent({
      proposalId: proposal.id,
      partyId: party.id,
      eventType: "TIER_SELECTED",
      metadata: { selectedTierId: tierId },
    });
  }

  if (!result.allSigned) {
    return { allSigned: false, checkoutUrl: null, proposalId: proposal.id };
  }

  await logEvent({ proposalId: proposal.id, eventType: "ALL_SIGNED" });

  if (isSignOnly(config)) {
    return { allSigned: true, checkoutUrl: null, proposalId: proposal.id };
  }

  const checkoutUrl = await ensureCheckoutSession(proposal.id, submission.rawToken);
  return { allSigned: true, checkoutUrl, proposalId: proposal.id };
}

/**
 * Creates (or reuses) the Checkout Session for a signed proposal. The Stripe
 * idempotency key is derived from the proposal + session generation, so
 * concurrent last-signer races resolve to a single session.
 */
export async function ensureCheckoutSession(
  proposalId: string,
  rawTokenForReturn: string
): Promise<string> {
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { parties: true },
  });
  const config = frozenPaymentConfig(proposal);
  const tokens = frozenTokens(proposal);
  const { oneTime, recurring } = effectiveLineItems(config, proposal.selectedTierId);
  if (!oneTime && !recurring) throw new Error("No payable line items");

  // Reuse a still-open session when one exists.
  if (proposal.stripeCheckoutSessionId) {
    const { retrieveSession } = await import("@/lib/stripe");
    const existing = await retrieveSession(proposal.stripeCheckoutSessionId);
    if (existing.status === "open" && existing.url) return existing.url;
  }

  const payer =
    proposal.parties.find((p) => p.payer && p.role === "CLIENT_SIGNER") ??
    proposal.parties.find((p) => p.role === "CLIENT_SIGNER");
  if (!payer) throw new Error("No payer party");

  const customer = await findOrCreateCustomer({ email: payer.email, name: payer.name });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:1235";
  const generation = await prisma.payment.count({ where: { proposalId } });
  const session = await createCheckoutSession({
    proposalId,
    proposalTitle: tokens["Client.ProposalTitle"],
    customerId: customer.id,
    oneTime,
    recurring,
    paymentConfig: config,
    successUrl: `${base}/sign/${rawTokenForReturn}/paid`,
    cancelUrl: `${base}/pay/${rawTokenForReturn}`,
    idempotencyKey: `checkout-${proposalId}-g${generation}-${proposal.stripeCheckoutSessionId ?? "first"}`,
  });

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { stripeCheckoutSessionId: session.id, stripeCustomerId: customer.id },
  });
  await logEvent({
    proposalId,
    eventType: "CHECKOUT_CREATED",
    metadata: { sessionId: session.id, customerId: customer.id },
  });

  if (!session.url) throw new Error("Stripe session has no URL");
  return session.url;
}

export async function declineProposal(input: {
  rawToken: string;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<{ proposalId: string }> {
  const gate = await gateToken(input.rawToken);
  if (!gate.ok) {
    throw new SigningError(
      gate.reason === "invalid" ? "invalid_token" : gate.reason,
      "Decline not available"
    );
  }
  const party = gate.party;
  if (party.signedAt) throw new SigningError("already_signed", "Already signed");

  const now = new Date();
  await prisma.$transaction([
    prisma.party.update({
      where: { id: party.id },
      data: { declinedAt: now, declinedReason: input.reason },
    }),
    prisma.proposal.update({
      where: { id: party.proposalId },
      data: { status: "DECLINED" },
    }),
  ]);
  await logEvent({
    proposalId: party.proposalId,
    partyId: party.id,
    eventType: "PARTY_DECLINED",
    metadata: { reason: input.reason, ipAddress: input.ipAddress, userAgent: input.userAgent },
  });
  return { proposalId: party.proposalId };
}

export function frozenPaymentConfig(proposal: Proposal): PaymentConfig {
  const frozen = proposal.frozenContent as { paymentConfig?: PaymentConfig } | null;
  return (frozen?.paymentConfig ?? proposal.paymentConfig) as PaymentConfig;
}

export function frozenTokens(proposal: Proposal): TokensJson {
  const frozen = proposal.frozenContent as { tokens?: TokensJson } | null;
  return (frozen?.tokens ?? proposal.tokens) as TokensJson;
}
