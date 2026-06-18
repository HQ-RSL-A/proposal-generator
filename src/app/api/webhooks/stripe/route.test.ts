import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");

// Keep NextResponse real; make after() a no-op (post-200 side effects aren't
// what this test asserts).
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: () => {} };
});

const { getStripe } = vi.hoisted(() => ({ getStripe: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe }));

const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ logEvent }));

const { enqueueJob } = vi.hoisted(() => ({ enqueueJob: vi.fn(async () => ({ id: "j" })) }));
vi.mock("@/lib/jobs", () => ({ enqueueJob }));

const { runJobNow } = vi.hoisted(() => ({ runJobNow: vi.fn(async () => {}) }));
vi.mock("@/lib/jobRunner", () => ({ runJobNow }));

import type { NextRequest } from "next/server";
import { prismaMock } from "@/test/db";
import { POST } from "./route";

const reqWith = (): NextRequest =>
  ({ headers: { get: () => "sig" }, text: async () => "{}" }) as unknown as NextRequest;

const paidEvent = () => ({
  id: "evt_paid_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      payment_status: "paid",
      metadata: { proposalId: "p1" },
      amount_total: 500000,
      currency: "usd",
    },
  },
});

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  getStripe.mockReturnValue({ webhooks: { constructEvent: () => paidEvent() } });
  prismaMock.webhookEvent.findUnique.mockResolvedValue(null); // not yet processed
});

describe("stripe webhook — process-then-record (RSL-6)", () => {
  it("does NOT mark the event processed when the paid transition throws, so Stripe's retry heals", async () => {
    prismaMock.proposal.updateMany.mockRejectedValueOnce(new Error("transient db error"));

    await expect(POST(reqWith())).rejects.toThrow("transient db error");

    // No marker written -> a redelivery re-runs the handler instead of being deduped.
    expect(prismaMock.webhookEvent.create).not.toHaveBeenCalled();
  });

  it("marks the event processed exactly once after the transition succeeds", async () => {
    prismaMock.proposal.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(reqWith());

    expect(res.status).toBe(200);
    expect(prismaMock.webhookEvent.create).toHaveBeenCalledOnce();
    const arg = prismaMock.webhookEvent.create.mock.calls[0][0] as { data: { externalId: string } };
    expect(arg.data.externalId).toBe("evt_paid_1");
  });

  it("skips an already-processed event at the pre-check (no reprocessing)", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue({
      id: "w",
      source: "stripe",
      externalId: "evt_paid_1",
      eventType: "checkout.session.completed",
      proposalId: "p1",
      processedAt: new Date(),
    });

    const res = await POST(reqWith());

    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(prismaMock.proposal.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.webhookEvent.create).not.toHaveBeenCalled();
  });
});
