import { beforeEach, describe, expect, it, vi } from "vitest";

// Isolate jobRunner from its heavy/IO dependencies; program them per test.
vi.mock("@/lib/prisma");

const { claimJobs, completeJob, failJob, reapStuckJobs } = vi.hoisted(() => ({
  claimJobs: vi.fn(),
  completeJob: vi.fn(async () => {}),
  failJob: vi.fn(async () => {}),
  reapStuckJobs: vi.fn(async () => 0),
}));
vi.mock("@/lib/jobs", () => ({ claimJobs, completeJob, failJob, reapStuckJobs }));

const { sendTemplateEmail } = vi.hoisted(() => ({
  sendTemplateEmail: vi.fn(async (..._args: unknown[]) => ({ ok: true })),
}));
vi.mock("@/lib/email", () => ({ sendTemplateEmail }));

const { rotatePartyToken } = vi.hoisted(() => ({ rotatePartyToken: vi.fn(async () => "rawtok") }));
// Keep the real isPayerTokenInFlight (the guard under test); only stub the network rotate.
vi.mock("@/lib/partyTokens", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/partyTokens")>()),
  rotatePartyToken,
}));

const { updateCrmOnPaid, noteOnSigned } = vi.hoisted(() => ({
  updateCrmOnPaid: vi.fn(async () => ({ pageId: "pg_1" })),
  noteOnSigned: vi.fn(async () => ({ pageId: "pg_1" })),
}));
vi.mock("@/lib/notion", () => ({ updateCrmOnPaid, noteOnSigned }));

vi.mock("@/lib/generatePdf", () => ({ generateAndStorePdf: vi.fn(async () => ({ blobUrl: "u" })) }));
vi.mock("@/lib/stripe", () => ({ attachCustomerMetadata: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ logEvent: vi.fn(async () => {}) }));

import { prismaMock } from "@/test/db";
import { makePendingJob } from "@/test/factories";
import { processDueJobs, runJobNow } from "./jobRunner";

beforeEach(() => {
  sendTemplateEmail.mockClear();
  sendTemplateEmail.mockResolvedValue({ ok: true });
  rotatePartyToken.mockClear();
  updateCrmOnPaid.mockClear();
  noteOnSigned.mockClear();
  claimJobs.mockReset();
  failJob.mockReset();
  failJob.mockResolvedValue(undefined);
  completeJob.mockReset();
  completeJob.mockResolvedValue(undefined);
});

describe("processDueJobs (RSL-13 batch isolation)", () => {
  it("keeps processing the batch when failJob throws for one job", async () => {
    const jobs = ["j1", "j2", "j3"].map((id) =>
      makePendingJob({ id, jobType: "SEND_EMAIL", payload: { templateId: "signing_reminder", proposalId: "p1" } })
    );
    claimJobs.mockResolvedValue(jobs);
    sendTemplateEmail.mockResolvedValue({ ok: false }); // every job throws inside executeJob
    failJob.mockRejectedValueOnce(new Error("bookkeeping db hiccup")); // first job's failJob throws

    const result = await processDueJobs(10);

    // One job's failJob throw must NOT abort the siblings: all three are attempted.
    expect(failJob).toHaveBeenCalledTimes(3);
    expect(result.ran).toBe(3);
  });
});

describe("NOTION_SYNC paid (RSL-15 idempotent append)", () => {
  const frozen = {
    tokens: { "Client.Company": "Acme" },
    paymentConfig: {
      currency: "usd",
      paymentMethods: ["card"],
      preferAch: false,
      oneTime: { amountCents: 1000, displayString: "$10", label: "Build" },
      recurring: null,
      tiers: null,
      addOns: [],
    },
  };
  const proposal = {
    id: "p1",
    frozenContent: frozen,
    tokens: {},
    paymentConfig: {},
    selectedTierId: null,
    selectedAddOnIds: [],
    stripeCustomerId: "cus_1",
    documents: [],
  };

  it("does not re-append or re-PATCH when a paid sync already recorded its marker", async () => {
    const job = makePendingJob({
      jobType: "NOTION_SYNC",
      proposalId: "p1",
      payload: { proposalId: "p1", kind: "paid" },
    });
    claimJobs.mockResolvedValue([job]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(proposal as any);

    // Run 1: no prior marker → the paid sync runs once.
    prismaMock.auditEvent.findFirst.mockResolvedValueOnce(null);
    await processDueJobs(10);
    expect(updateCrmOnPaid).toHaveBeenCalledTimes(1);

    // Run 2 (retry after a post-append throw): marker present → append is skipped.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.auditEvent.findFirst.mockResolvedValueOnce({ id: "ae_1" } as any);
    await processDueJobs(10);
    expect(updateCrmOnPaid).toHaveBeenCalledTimes(1);
  });
});

describe("SEND_EMAIL retry (RSL-14 payer-token guard)", () => {
  it("does not rotate the payer's token while their payment is in flight", async () => {
    const job = makePendingJob({
      jobType: "SEND_EMAIL",
      proposalId: "p1",
      payload: { templateId: "fully_signed_client", partyId: "payer", proposalId: "p1", needsToken: true },
    });
    claimJobs.mockResolvedValue([job]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.party.findUnique.mockResolvedValue({ id: "payer", payer: true, proposal: { paymentStatus: "AWAITING" } } as any);

    await processDueJobs(10);

    expect(rotatePartyToken).not.toHaveBeenCalled();
  });

  it("still rotates a non-payer's token on a token-bearing retry", async () => {
    const job = makePendingJob({
      jobType: "SEND_EMAIL",
      proposalId: "p1",
      payload: { templateId: "signing_reminder", partyId: "cosigner", proposalId: "p1", needsToken: true },
    });
    claimJobs.mockResolvedValue([job]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.party.findUnique.mockResolvedValue({ id: "cosigner", payer: false, proposal: { paymentStatus: "AWAITING" } } as any);

    await processDueJobs(10);

    expect(rotatePartyToken).toHaveBeenCalledWith("cosigner");
  });
});

describe("SEND_EMAIL deferred payer resolution (RSL-27)", () => {
  const payerReceiptJob = () =>
    makePendingJob({
      jobType: "SEND_EMAIL",
      proposalId: "p1",
      payload: {
        templateId: "payment_received_client",
        proposalId: "p1",
        resolvePartyByRole: "CLIENT_SIGNER_PAYER",
        context: {},
      },
    });

  it("resolves the payer at execution time and sends the client receipt", async () => {
    claimJobs.mockResolvedValue([payerReceiptJob()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.party.findFirst.mockResolvedValue({ id: "payer1", payer: true } as any);

    await processDueJobs(10);

    expect(prismaMock.party.findFirst).toHaveBeenCalled();
    const call = sendTemplateEmail.mock.calls[0];
    expect(call[0]).toBe("payment_received_client");
    expect(call[2]).toBe("payer1"); // payer resolved into partyId
    expect(completeJob).toHaveBeenCalled();
    expect(failJob).not.toHaveBeenCalled();
  });

  it("is a clean no-op (job completes, no send) when no payer party exists", async () => {
    claimJobs.mockResolvedValue([payerReceiptJob()]);
    prismaMock.party.findFirst.mockResolvedValue(null);

    await processDueJobs(10);

    expect(sendTemplateEmail).not.toHaveBeenCalled();
    expect(completeJob).toHaveBeenCalledTimes(1);
    expect(failJob).not.toHaveBeenCalled();
  });

  it("fails the job (queue retries) when payer resolution throws", async () => {
    claimJobs.mockResolvedValue([payerReceiptJob()]);
    prismaMock.party.findFirst.mockRejectedValue(new Error("db down"));

    await processDueJobs(10);

    expect(sendTemplateEmail).not.toHaveBeenCalled();
    expect(failJob).toHaveBeenCalledTimes(1);
  });
});

describe("SEND_EMAIL idempotency key passthrough (RSL-28)", () => {
  it("forwards payload.idempotencyKey to sendTemplateEmail", async () => {
    const job = makePendingJob({
      jobType: "SEND_EMAIL",
      proposalId: "p1",
      payload: {
        templateId: "payment_failed_client",
        partyId: "payer1",
        proposalId: "p1",
        idempotencyKey: "emailkey-evt_x-payment_failed_client",
      },
    });
    claimJobs.mockResolvedValue([job]);

    await processDueJobs(10);

    expect(sendTemplateEmail.mock.calls[0][5]).toBe("emailkey-evt_x-payment_failed_client");
  });
});

describe("runJobNow (RSL-13 backoff gate)", () => {
  it("claims a job only once its scheduledAt backoff has elapsed", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]); // not yet due → no row claimed

    await runJobNow("job_1");

    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
    const sql = (prismaMock.$queryRaw.mock.calls[0][0] as unknown as string[]).join(" ");
    expect(sql).toContain("scheduledAt");
  });
});
