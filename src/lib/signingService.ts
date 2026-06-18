import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { blobPaths, putPrivate } from "@/lib/blob";
import { logEvent } from "@/lib/audit";
import { gateToken } from "@/lib/partyTokens";
import { createCheckoutSession, findOrCreateCustomer } from "@/lib/stripe";
import {
  effectiveCheckout,
  isSignOnly,
  type PaymentConfig,
  type TokensJson,
  type TrackRecordConfig,
} from "@/lib/types";
import { resolveTrackRecord } from "@/lib/trackRecord";
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
      | "bad_signature"
      | "config_error",
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
  /** Global add-on ids the client toggled on. */
  selectedAddOnIds: string[];
  /** Client-side tap times of the two-place ceremony (ISO strings). */
  stampedProposalAt: string | null;
  stampedAgreementAt: string | null;
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

/** Post-commit audit writes must never reject an already-committed sign (RSL-9). */
async function safeLogEvent(input: Parameters<typeof logEvent>[0]): Promise<void> {
  try {
    await logEvent(input);
  } catch (error) {
    console.error("post-commit logEvent failed (sign already committed)", error);
  }
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

  const addOnIds = submission.selectedAddOnIds ?? [];
  if (addOnIds.length > 0) {
    const validIds = new Set((config.addOns ?? []).map((a) => a.id));
    for (const id of addOnIds) {
      if (!validIds.has(id)) {
        throw new SigningError("bad_signature", `Unknown add-on: ${id}`);
      }
    }
  }

  // Unique per-submit blob key (RSL-10): two concurrent same-party submits used
  // to write the SAME fixed key (last-writer-wins), so the committed Signature
  // row's imageBlobUrl could end up pointing at the REJECTED submit's image. A
  // per-submit key means the committed row always references the bytes of the
  // submit that actually committed; a losing submit's blob is simply orphaned.
  const png = decodeSignaturePng(submission.signaturePngDataUrl);
  const { url: imageBlobUrl } = await putPrivate(
    blobPaths.signature(proposal.id, party.id, randomUUID()),
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
          stampedProposalAt: submission.stampedProposalAt
            ? new Date(submission.stampedProposalAt)
            : null,
          stampedAgreementAt: submission.stampedAgreementAt
            ? new Date(submission.stampedAgreementAt)
            : null,
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
          data: { status: "PARTIALLY_SIGNED", selectedTierId: tierId, selectedAddOnIds: addOnIds },
        });
        return { allSigned: false };
      }

      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: "SIGNED",
          completedAt: now,
          selectedTierId: tierId,
          selectedAddOnIds: addOnIds,
          paymentStatus: isSignOnly(config) ? "NOT_REQUIRED" : "AWAITING",
        },
      });
      return { allSigned: true };
    },
    { isolationLevel: "Serializable" }
  );

  // The signature is now legally committed. Everything below is post-commit
  // bookkeeping; none of it may reject an already-committed sign (RSL-9), or the
  // client gets an error screen after legally signing (and hits "already signed"
  // on retry). Audit writes are best-effort; the checkout build is recoverable.
  await safeLogEvent({
    proposalId: proposal.id,
    partyId: party.id,
    eventType: "ESIGN_CONSENTED",
    metadata: { ipAddress: submission.ipAddress, userAgent: submission.userAgent },
  });
  await safeLogEvent({
    proposalId: proposal.id,
    partyId: party.id,
    eventType: "PARTY_SIGNED",
    metadata: {
      method: submission.signatureType,
      adoptedName: submission.adoptedName,
      ipAddress: submission.ipAddress,
      userAgent: submission.userAgent,
      ...(submission.stampedProposalAt || submission.stampedAgreementAt
        ? {
            placements: {
              proposalAcceptance: submission.stampedProposalAt,
              agreementExecution: submission.stampedAgreementAt,
            },
          }
        : {}),
      ...(tierId ? { selectedTierId: tierId } : {}),
    },
  });
  if (tierId && tierId !== proposal.selectedTierId) {
    await safeLogEvent({
      proposalId: proposal.id,
      partyId: party.id,
      eventType: "TIER_SELECTED",
      metadata: { selectedTierId: tierId },
    });
  }

  if (!result.allSigned) {
    return { allSigned: false, checkoutUrl: null, proposalId: proposal.id };
  }

  await safeLogEvent({ proposalId: proposal.id, eventType: "ALL_SIGNED" });

  if (isSignOnly(config)) {
    return { allSigned: true, checkoutUrl: null, proposalId: proposal.id };
  }

  // A checkout-build failure must not 500 a completed sign — the client has
  // legally signed. Return no URL and let them pay via the signed-copy email
  // link or the /pay page, which rebuilds the session (RSL-9).
  let checkoutUrl: string | null = null;
  try {
    checkoutUrl = await ensureCheckoutSession(proposal.id, submission.rawToken);
  } catch (error) {
    console.error("post-sign checkout build failed; recoverable via /pay", error);
  }
  return { allSigned: true, checkoutUrl, proposalId: proposal.id };
}

/**
 * Creates (or reuses) the Checkout Session for a signed proposal. Reuse-or-refuse
 * (RSL-7): an open session is reused; a complete/paid session — or a non-AWAITING
 * payment status — refuses to mint a second payable session (closing the
 * webhook-lag double-charge window); only an expired session is re-minted. The
 * Stripe idempotency key is derived from stable inputs (proposal + mint
 * generation, never the mutable session id), so concurrent last-signer races
 * resolve to one session and a transient retry is deduped.
 */
export async function ensureCheckoutSession(
  proposalId: string,
  rawTokenForReturn: string
): Promise<string> {
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { parties: true },
  });

  // Stop condition (RSL-7): never mint a new payable session once payment is
  // settled or in flight — that is exactly how a client gets double-charged in
  // the gap between Stripe completing a session and the webhook flipping status.
  if (proposal.paymentStatus === "PAID" || proposal.paymentStatus === "PROCESSING") {
    throw new Error(`Refusing to mint a checkout session: payment is ${proposal.paymentStatus}`);
  }

  const config = frozenPaymentConfig(proposal);
  const tokens = frozenTokens(proposal);
  const selectedAddOnIds = (proposal.selectedAddOnIds as unknown as string[] | null) ?? [];
  const checkout = effectiveCheckout(config, proposal.selectedTierId, selectedAddOnIds);
  if (checkout.lineItems.length === 0) throw new Error("No payable line items");

  // Reuse-or-refuse: reuse a still-open session; refuse to duplicate a session
  // that's already complete (paid/processing); only an expired one re-mints.
  if (proposal.stripeCheckoutSessionId) {
    const { retrieveSession } = await import("@/lib/stripe");
    const existing = await retrieveSession(proposal.stripeCheckoutSessionId);
    if (existing.status === "open" && existing.url) return existing.url;
    if (existing.status === "complete") {
      throw new Error("Refusing to mint a checkout session: the existing session is already complete");
    }
    // existing.status === "expired" -> fall through and mint a fresh session
  }

  const payer =
    proposal.parties.find((p) => p.payer && p.role === "CLIENT_SIGNER") ??
    proposal.parties.find((p) => p.role === "CLIENT_SIGNER");
  if (!payer) throw new Error("No payer party");

  const customer = await findOrCreateCustomer({ email: payer.email, name: payer.name });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:1235";
  // Mint generation = sessions already created for this proposal. It's stable
  // across a transient retry of the SAME mint (CHECKOUT_CREATED isn't logged
  // until success), so the retry computes the SAME idempotency key and Stripe
  // dedupes it — yet a deliberate re-mint after an expired session gets a fresh
  // generation, so it isn't deduped into the stale session. Never the mutable
  // session id (RSL-7).
  const generation = await prisma.auditEvent.count({
    where: { proposalId, eventType: "CHECKOUT_CREATED" },
  });
  const session = await createCheckoutSession({
    proposalId,
    proposalTitle: tokens["Client.ProposalTitle"],
    customerId: customer.id,
    checkout,
    paymentConfig: config,
    // Stripe substitutes the placeholder; the session id lets the /paid page
    // identify the proposal even if the path token was rotated mid-checkout.
    successUrl: `${base}/sign/${rawTokenForReturn}/paid?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/pay/${rawTokenForReturn}`,
    idempotencyKey: `checkout-${proposalId}-g${generation}`,
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
  // Record this party's decline, but only move the whole proposal to DECLINED
  // when no signature has been committed yet (RSL-20). A committed signature
  // (PARTIALLY_SIGNED / SIGNED) is a legal record that must not be reverted by a
  // later party's decline — the proposal stays as-is and an admin can void it.
  await prisma.$transaction(async (tx) => {
    await tx.party.update({
      where: { id: party.id },
      data: { declinedAt: now, declinedReason: input.reason },
    });
    await tx.proposal.updateMany({
      where: { id: party.proposalId, status: { in: ["SENT", "VIEWED"] } },
      data: { status: "DECLINED" },
    });
  });
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
  const raw = (frozen?.paymentConfig ?? proposal.paymentConfig) as unknown;
  // Validate shape on read (RSL-21): a malformed frozen config (e.g. a non-array
  // `tiers` from a legacy or hand-edited snapshot) used to throw a raw
  // `TypeError: config.tiers.some is not a function` mid-sign. Surface a handled
  // SigningError instead so the sign route returns a clean 422.
  if (!raw || typeof raw !== "object") {
    throw new SigningError("config_error", "This proposal's pricing could not be loaded.");
  }
  const config = raw as PaymentConfig;
  if (config.tiers != null && !Array.isArray(config.tiers)) {
    throw new SigningError("config_error", "This proposal's pricing is misconfigured.");
  }
  if (config.addOns != null && !Array.isArray(config.addOns)) {
    throw new SigningError("config_error", "This proposal's pricing is misconfigured.");
  }
  return config;
}

export function frozenTokens(proposal: Proposal): TokensJson {
  const frozen = proposal.frozenContent as { tokens?: TokensJson } | null;
  return (frozen?.tokens ?? proposal.tokens) as TokensJson;
}

export function frozenTrackRecord(proposal: Proposal): TrackRecordConfig {
  const frozen = proposal.frozenContent as { trackRecord?: unknown } | null;
  return resolveTrackRecord(frozen?.trackRecord ?? proposal.trackRecord);
}
