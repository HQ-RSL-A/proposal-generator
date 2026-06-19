import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");

// Capture after() callbacks so we can run the first-send enqueue blocks deterministically.
const { afterCallbacks } = vi.hoisted(() => ({ afterCallbacks: [] as Array<() => unknown> }));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => unknown) => {
      afterCallbacks.push(fn);
    },
  };
});

const { getStripe } = vi.hoisted(() => ({ getStripe: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe }));

const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ logEvent }));

const { enqueueJob } = vi.hoisted(() => ({
  enqueueJob: vi.fn(
    async (_input: { jobType: string; proposalId?: string | null; payload: Record<string, unknown> }) => ({
      id: "j",
    })
  ),
}));
vi.mock("@/lib/jobs", () => ({ enqueueJob }));

const { runJobNow } = vi.hoisted(() => ({ runJobNow: vi.fn(async () => {}) }));
vi.mock("@/lib/jobRunner", () => ({ runJobNow }));

// The async_payment_failed branch dynamically imports sendTemplateEmail for the admin alert.
vi.mock("@/lib/email", () => ({ sendTemplateEmail: vi.fn(async () => ({ ok: true, logId: "l" })) }));

import type { NextRequest } from "next/server";
import { prismaMock } from "@/test/db";
import { makeParty } from "@/test/factories";
import { POST } from "./route";

const reqWith = (): NextRequest =>
  ({ headers: { get: () => "sig" }, text: async () => "{}" }) as unknown as NextRequest;

async function runAfters() {
  const cbs = [...afterCallbacks];
  afterCallbacks.length = 0;
  for (const cb of cbs) await cb();
}

const firstSendKey = (templateId: string): string | undefined => {
  const call = enqueueJob.mock.calls.find(
    (c) => (c[0].payload as { templateId?: string }).templateId === templateId
  );
  return call ? (call[0].payload as { idempotencyKey?: string }).idempotencyKey : undefined;
};

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  enqueueJob.mockClear();
  afterCallbacks.length = 0;
  prismaMock.webhookEvent.findUnique.mockResolvedValue(null); // not yet processed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaMock.party.findFirst.mockResolvedValue(makeParty({ id: "payer1", payer: true }) as any);
});

describe("stripe webhook first-send idempotency (RSL-28)", () => {
  it("enqueues payment_failed_client with a deterministic event-derived idempotency key", async () => {
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: () => ({
          id: "evt_fail_9",
          type: "checkout.session.async_payment_failed",
          data: { object: { id: "cs_1", metadata: { proposalId: "p1" } } },
        }),
      },
    });
    prismaMock.proposal.updateMany.mockResolvedValue({ count: 1 });

    await POST(reqWith());
    await runAfters();

    expect(firstSendKey("payment_failed_client")).toBe("emailkey-evt_fail_9-payment_failed_client");
  });

  it("enqueues payment_link with a deterministic key on checkout.session.expired", async () => {
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: () => ({
          id: "evt_exp_3",
          type: "checkout.session.expired",
          data: { object: { id: "cs_1", metadata: { proposalId: "p1" } } },
        }),
      },
    });
    prismaMock.proposal.updateMany.mockResolvedValue({ count: 1 }); // count>0 gates the after() block

    await POST(reqWith());
    await runAfters();

    expect(firstSendKey("payment_link")).toBe("emailkey-evt_exp_3-payment_link");
  });
});
