import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");

// Capture after() callbacks so the test can run them deterministically
// (applyPaidState doesn't await its after() block).
const { afterCallbacks } = vi.hoisted(() => ({ afterCallbacks: [] as Array<() => unknown> }));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    afterCallbacks.push(fn);
  },
}));

const { enqueueJob } = vi.hoisted(() => ({
  enqueueJob: vi.fn(
    async (_input: { jobType: string; proposalId?: string | null; payload: Record<string, unknown> }) => ({
      id: "job_id",
    })
  ),
}));
vi.mock("@/lib/jobs", () => ({ enqueueJob }));

const { runJobNow } = vi.hoisted(() => ({ runJobNow: vi.fn(async () => {}) }));
vi.mock("@/lib/jobRunner", () => ({ runJobNow }));

const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ logEvent }));

import type Stripe from "stripe";
import { prismaMock } from "@/test/db";
import { makeParty, makeProposal } from "@/test/factories";
import { applyPaidState, markWebhookProcessed, wasWebhookProcessed } from "@/lib/paymentState";

const session = {
  id: "cs_test_1",
  amount_total: 500000,
  currency: "usd",
  customer: "cus_1",
  payment_intent: "pi_1",
  subscription: null,
  payment_method_types: ["card"],
} as unknown as Stripe.Checkout.Session;

async function runAfters() {
  const cbs = [...afterCallbacks];
  afterCallbacks.length = 0;
  for (const cb of cbs) await cb();
}

const enqueuedTemplates = () =>
  enqueueJob.mock.calls.map((c) => (c[0].payload as { templateId?: string }).templateId);

beforeEach(() => {
  enqueueJob.mockClear();
  runJobNow.mockClear();
  logEvent.mockClear();
  afterCallbacks.length = 0;
});

describe("wasWebhookProcessed", () => {
  it("is false with no event row, true when one exists", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValueOnce(null);
    expect(await wasWebhookProcessed("evt_1")).toBe(false);

    prismaMock.webhookEvent.findUnique.mockResolvedValueOnce({
      id: "w1",
      source: "stripe",
      externalId: "evt_1",
      eventType: "x",
      proposalId: null,
      processedAt: new Date(),
    });
    expect(await wasWebhookProcessed("evt_1")).toBe(true);
  });
});

describe("markWebhookProcessed", () => {
  it("writes the marker row", async () => {
    await markWebhookProcessed({ source: "stripe", externalId: "evt_1", eventType: "x" });
    expect(prismaMock.webhookEvent.create).toHaveBeenCalledOnce();
  });

  it("swallows a duplicate (P2002) marker so a concurrent delivery is harmless", async () => {
    prismaMock.webhookEvent.create.mockRejectedValueOnce({ code: "P2002" });
    await expect(
      markWebhookProcessed({ source: "stripe", externalId: "evt_1", eventType: "x" })
    ).resolves.toBeUndefined();
  });

  it("rethrows a non-unique error", async () => {
    prismaMock.webhookEvent.create.mockRejectedValueOnce(new Error("db down"));
    await expect(
      markWebhookProcessed({ source: "stripe", externalId: "evt_1", eventType: "x" })
    ).rejects.toThrow("db down");
  });
});

describe("applyPaidState — exactly-once on redelivery", () => {
  it("is a no-op when the proposal is already PAID (updateMany count 0)", async () => {
    prismaMock.proposal.updateMany.mockResolvedValueOnce({ count: 0 });

    await applyPaidState("p1", session);
    await runAfters();

    expect(prismaMock.payment.upsert).not.toHaveBeenCalled();
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});

describe("applyPaidState — receipts are durable (RSL-8)", () => {
  beforeEach(() => {
    prismaMock.proposal.updateMany.mockResolvedValue({ count: 1 });
  });

  it("enqueues admin + client receipts as SEND_EMAIL jobs, not inline sends", async () => {
    prismaMock.proposal.findUnique.mockResolvedValueOnce(makeProposal({ id: "p1" }));
    prismaMock.party.findFirst.mockResolvedValueOnce(makeParty({ id: "payer1", payer: true }));

    await applyPaidState("p1", session);
    await runAfters();

    expect(enqueuedTemplates()).toContain("payment_received_admin");
    expect(enqueuedTemplates()).toContain("payment_received_client");
  });

  it("still enqueues both receipts when the deposit-note read throws", async () => {
    // This is the read that used to silently lose the receipt entirely.
    prismaMock.proposal.findUnique.mockRejectedValueOnce(new Error("transient read"));
    prismaMock.party.findFirst.mockResolvedValueOnce(makeParty({ id: "payer1", payer: true }));

    await applyPaidState("p1", session);
    await runAfters();

    expect(enqueuedTemplates()).toContain("payment_received_admin");
    expect(enqueuedTemplates()).toContain("payment_received_client");
    // ...and the receipt just goes out without the deposit note.
    const adminCall = enqueueJob.mock.calls.find(
      (c) => (c[0].payload as { templateId?: string }).templateId === "payment_received_admin"
    );
    expect((adminCall![0].payload as { context: { depositNote?: string } }).context.depositNote).toBeUndefined();
  });

  it("still enqueues the admin receipt even if the payer lookup throws", async () => {
    prismaMock.proposal.findUnique.mockResolvedValueOnce(makeProposal({ id: "p1" }));
    prismaMock.party.findFirst.mockRejectedValueOnce(new Error("payer lookup failed"));

    await applyPaidState("p1", session);
    await expect(runAfters()).rejects.toThrow("payer lookup failed");

    // Admin receipt was enqueued before the payer query, so it's durable.
    expect(enqueuedTemplates()).toContain("payment_received_admin");
  });
});
