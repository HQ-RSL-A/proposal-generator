// Fixture builders for the models the audit fixes exercise. Each returns a
// fully-populated row (every scalar column present, matching the Prisma model
// type) with sensible defaults; pass a `Partial` to override what a test cares
// about. Mirrors the existing `mk()` pattern in dashboardMetrics.test.ts.
import type {
  EmailLog,
  Party,
  PendingJob,
  Proposal,
  Signature,
} from "@/generated/prisma/client";

let seq = 0;
/** Stable, unique, human-readable ids so relations line up across factories. */
const nextId = (prefix: string) => `${prefix}_${(++seq).toString(36).padStart(4, "0")}`;

/** Fixed clock so date-sensitive assertions are deterministic. */
export const BASE_DATE = new Date("2026-06-15T12:00:00.000Z");

export function makeProposal(over: Partial<Proposal> = {}): Proposal {
  return {
    id: nextId("prop"),
    versionNumber: 1,
    parentId: null,
    title: "Brightline Test Co Proposal",
    status: "SENT",
    paymentStatus: "AWAITING",
    tokens: {},
    paymentConfig: {},
    trackRecord: null,
    msaVersionId: "msa_v3",
    frozenContent: null,
    contentHash: null,
    frozenAt: null,
    validUntil: null,
    selectedTierId: null,
    selectedAddOnIds: [],
    stripeCheckoutSessionId: null,
    stripeCustomerId: null,
    notionPageId: null,
    sentAt: BASE_DATE,
    completedAt: null,
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...over,
  };
}

export function makeParty(over: Partial<Party> = {}): Party {
  const id = over.id ?? nextId("party");
  return {
    id,
    proposalId: nextId("prop"),
    role: "CLIENT_SIGNER",
    name: "Test Signer",
    email: `${id}@example.com`,
    payer: false,
    orderIndex: 0,
    signingTokenHash: null,
    tokenExpiresAt: null,
    signedAt: null,
    declinedAt: null,
    declinedReason: null,
    emailBounced: false,
    emailComplained: false,
    createdAt: BASE_DATE,
    ...over,
  };
}

export function makeSignature(over: Partial<Signature> = {}): Signature {
  return {
    id: nextId("sig"),
    proposalId: nextId("prop"),
    partyId: nextId("party"),
    type: "DRAWN",
    imageBlobUrl: "https://blob.example/signature.png",
    adoptedName: "Test Signer",
    signerTitle: null,
    signerCompany: null,
    fontFamily: null,
    esignConsented: true,
    consentedAt: BASE_DATE,
    signedAt: BASE_DATE,
    stampedProposalAt: null,
    stampedAgreementAt: null,
    ipAddress: null,
    userAgent: null,
    ...over,
  };
}

export function makePendingJob(over: Partial<PendingJob> = {}): PendingJob {
  return {
    id: nextId("job"),
    jobType: "SEND_EMAIL",
    status: "PENDING",
    payload: {},
    proposalId: null,
    attempts: 0,
    maxAttempts: 5,
    lastError: null,
    scheduledAt: BASE_DATE,
    processingAt: null,
    completedAt: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...over,
  };
}

export function makeEmailLog(over: Partial<EmailLog> = {}): EmailLog {
  return {
    id: nextId("email"),
    proposalId: nextId("prop"),
    partyId: null,
    templateId: "signing_reminder",
    recipient: "signer@example.com",
    subject: "Test subject",
    resendMessageId: null,
    status: "SENT",
    error: null,
    sentAt: BASE_DATE,
    deliveredAt: null,
    openedAt: null,
    bouncedAt: null,
    ...over,
  };
}
