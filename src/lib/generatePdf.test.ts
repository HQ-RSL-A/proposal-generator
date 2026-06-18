import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer: vi.fn(async () => Buffer.from("PDF")) }));
vi.mock("@/components/pdf/ProposalPdf", () => ({ ProposalPdf: () => null }));
vi.mock("@/lib/proposalContent", () => ({ sectionsFromFrozen: vi.fn(() => ({})) }));
vi.mock("@/lib/blob", () => ({
  blobPaths: { signedPdf: () => "signed/p.pdf" },
  putPrivate: vi.fn(async () => ({ url: "https://blob.example/signed.pdf" })),
  fetchPrivateBlob: vi.fn(async () => Buffer.from("png")),
}));

const { sendTemplateEmail } = vi.hoisted(() => ({
  sendTemplateEmail: vi.fn<
    (t: string, p?: string, party?: string | null, ctx?: Record<string, unknown>) => Promise<{ ok: boolean }>
  >(async () => ({ ok: true })),
}));
vi.mock("@/lib/email", () => ({ sendTemplateEmail }));
const { rotatePartyToken } = vi.hoisted(() => ({ rotatePartyToken: vi.fn(async () => "rawtok") }));
vi.mock("@/lib/partyTokens", () => ({ rotatePartyToken }));
vi.mock("@/lib/audit", () => ({ logEvent: vi.fn(async () => {}) }));

import { prismaMock } from "@/test/db";
import { makeEmailLog, makeParty, makeProposal } from "@/test/factories";
import { generateAndStorePdf } from "./generatePdf";

/** Proposal preloaded with the relations generateAndStorePdf includes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadedProposal(parties: any[]) {
  return {
    ...makeProposal({ id: "p1", paymentStatus: "AWAITING", frozenContent: { tokens: { "Client.Company": "Acme" } } }),
    parties,
    signatures: [],
    auditEvents: [],
    msaVersion: { version: "3.0", bodyMarkdown: "MSA" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const t0 = new Date("2026-06-15T10:00:00Z");
const t1 = new Date("2026-06-15T11:00:00Z");

beforeEach(() => {
  sendTemplateEmail.mockClear();
  sendTemplateEmail.mockResolvedValue({ ok: true });
  rotatePartyToken.mockClear();
  prismaMock.emailLog.findFirst.mockResolvedValue(null); // nothing sent yet by default
});

const clientCalls = () =>
  sendTemplateEmail.mock.calls.filter((c) => c[0] === "fully_signed_client");
const adminCalls = () =>
  sendTemplateEmail.mock.calls.filter((c) => c[0] === "fully_signed_admin");

describe("generateAndStorePdf — executed-copy emails", () => {
  it("does not rotate the payer's token when a non-payer co-signer signs last (RSL-14)", async () => {
    const payer = makeParty({ id: "payer", role: "CLIENT_SIGNER", payer: true, orderIndex: 1, signedAt: t0 });
    const cosigner = makeParty({ id: "cosigner", role: "CLIENT_SIGNER", payer: false, orderIndex: 0, signedAt: t1 });
    prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(loadedProposal([cosigner, payer]));

    await generateAndStorePdf("p1");

    expect(rotatePartyToken).not.toHaveBeenCalled();
    expect(clientCalls()).toHaveLength(2);
    // The payer's executed-copy email carries no rotated token (recover via session_id self-heal).
    const payerCall = clientCalls().find((c) => c[2] === "payer");
    expect(payerCall?.[3]).not.toHaveProperty("rawToken");
  });

  it("does not rotate the payer's token when signedAt is tied (RSL-14)", async () => {
    const payer = makeParty({ id: "payer", role: "CLIENT_SIGNER", payer: true, orderIndex: 1, signedAt: t0 });
    const cosigner = makeParty({ id: "cosigner", role: "CLIENT_SIGNER", payer: false, orderIndex: 0, signedAt: t0 });
    prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(loadedProposal([cosigner, payer]));

    await generateAndStorePdf("p1");

    expect(rotatePartyToken).not.toHaveBeenCalled();
  });

  it("re-sends only the failed admin email, not the client copies, on regeneration (RSL-22)", async () => {
    const payer = makeParty({ id: "payer", role: "CLIENT_SIGNER", payer: true, orderIndex: 1, signedAt: t1 });
    const cosigner = makeParty({ id: "cosigner", role: "CLIENT_SIGNER", payer: false, orderIndex: 0, signedAt: t0 });
    prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(loadedProposal([cosigner, payer]));

    // Client copies already delivered; the admin copy failed (no non-FAILED admin row).
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (prismaMock.emailLog.findFirst as any).mockImplementation(async (args: any) =>
      args.where.templateId === "fully_signed_client"
        ? makeEmailLog({ status: "SENT", partyId: args.where.partyId })
        : null
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */

    await generateAndStorePdf("p1");

    expect(clientCalls()).toHaveLength(0); // clients NOT re-mailed
    expect(adminCalls()).toHaveLength(1); // only the failed admin email re-sent
  });
});
