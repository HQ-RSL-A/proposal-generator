import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: () => {} };
});

vi.mock("@/lib/cronAuth", () => ({
  isAuthorizedCron: () => true,
  logCronRun: vi.fn(async () => {}),
}));

const { retrieveSession } = vi.hoisted(() => ({
  retrieveSession: vi.fn(async () => ({ id: "cs_1", payment_status: "paid", status: "complete" })),
}));
vi.mock("@/lib/stripe", () => ({ retrieveSession }));

vi.mock("@/lib/audit", () => ({ logEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/jobs", () => ({ enqueueJob: vi.fn(async () => ({ id: "j" })) }));
vi.mock("@/lib/jobRunner", () => ({ runJobNow: vi.fn(async () => {}) }));

import type { NextRequest } from "next/server";
import { prismaMock } from "@/test/db";
import { makeProposal } from "@/test/factories";
import { GET } from "./route";

const req = () => ({}) as unknown as NextRequest;

beforeEach(() => {
  prismaMock.proposal.findMany.mockResolvedValue([
    makeProposal({
      id: "p1",
      status: "SIGNED",
      paymentStatus: "AWAITING",
      stripeCheckoutSessionId: "cs_1",
    }),
  ]);
  prismaMock.webhookEvent.findUnique.mockResolvedValue(null); // no prior marker
});

describe("reconcile cron — heals after a prior failed heal (RSL-6)", () => {
  it("does NOT record a marker when applyPaidState throws, so a later run can still heal", async () => {
    prismaMock.proposal.updateMany.mockRejectedValueOnce(new Error("transient db error"));

    const res = await GET(req());
    const body = (await res.json()) as { healed: number };

    expect(body.healed).toBe(0);
    expect(prismaMock.webhookEvent.create).not.toHaveBeenCalled();
  });

  it("heals and records the marker once when the paid transition succeeds", async () => {
    prismaMock.proposal.updateMany.mockResolvedValue({ count: 1 });

    const res = await GET(req());
    const body = (await res.json()) as { healed: number };

    expect(body.healed).toBe(1);
    expect(prismaMock.webhookEvent.create).toHaveBeenCalledOnce();
  });
});
