import { prisma } from "@/lib/prisma";
import { generateSigningToken, hashToken, isWellFormedToken } from "@/lib/tokens";
import type { Party, Proposal } from "@/generated/prisma/client";

/**
 * Issues a fresh token for a party, invalidating any prior link. Every email
 * that embeds a signing/payment link calls this first, so the latest email
 * always holds the working link and raw tokens never need to be stored.
 */
export async function rotatePartyToken(partyId: string): Promise<string> {
  const { raw, hash } = generateSigningToken();
  await prisma.party.update({
    where: { id: partyId },
    data: { signingTokenHash: hash },
  });
  return raw;
}

/**
 * Is this party's token live in an open Stripe Checkout right now? By design the payer signs
 * last and goes straight to checkout, so their token is baked into the success_url/cancel_url
 * while payment is awaiting or processing — rotating it then would 404 the page Stripe returns
 * them to. The ONE payer-identity rotation guard, shared by the executed-copy email
 * (generatePdf) and the SEND_EMAIL retry path (jobRunner); never keyed on signer ordering,
 * which mis-identifies the payer on tied timestamps or a non-payer signing last (RSL-14).
 */
export function isPayerTokenInFlight(
  party: { payer: boolean },
  paymentStatus: string
): boolean {
  return party.payer && (paymentStatus === "AWAITING" || paymentStatus === "PROCESSING");
}

export type PartyWithProposal = Party & { proposal: Proposal };

export async function findPartyByToken(rawToken: string): Promise<PartyWithProposal | null> {
  if (!isWellFormedToken(rawToken)) return null;
  return prisma.party.findUnique({
    where: { signingTokenHash: hashToken(rawToken) },
    include: { proposal: true },
  });
}

export type TokenGateResult =
  | { ok: true; party: PartyWithProposal }
  | { ok: false; reason: "invalid" | "expired" | "voided" | "declined" };

/**
 * Validates a token for the signing page. Pre-signature, expiry and proposal
 * state gate access; post-signature the token stays valid so the party can
 * reach their confirmation page and (for the payer) the payment recovery page.
 */
export async function gateToken(rawToken: string): Promise<TokenGateResult> {
  const party = await findPartyByToken(rawToken);
  if (!party) return { ok: false, reason: "invalid" };

  const { proposal } = party;
  if (proposal.status === "VOIDED") return { ok: false, reason: "voided" };
  if (party.signedAt) return { ok: true, party };
  if (party.declinedAt || proposal.status === "DECLINED") {
    return { ok: false, reason: "declined" };
  }
  if (
    proposal.status === "EXPIRED" ||
    (proposal.validUntil && proposal.validUntil.getTime() < Date.now()) ||
    (party.tokenExpiresAt && party.tokenExpiresAt.getTime() < Date.now())
  ) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, party };
}
