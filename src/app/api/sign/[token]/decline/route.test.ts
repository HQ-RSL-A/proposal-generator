import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");

// Capture after() callbacks so we can assert what the admin-email block does.
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

vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: () => true }));

// Keep the real SigningError (route does `instanceof`), mock only declineProposal.
const { declineProposal } = vi.hoisted(() => ({ declineProposal: vi.fn() }));
vi.mock("@/lib/signingService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/signingService")>()),
  declineProposal,
}));

const { sendTemplateEmail } = vi.hoisted(() => ({
  sendTemplateEmail: vi.fn(async (..._args: unknown[]) => ({ ok: true, logId: "l" })),
}));
vi.mock("@/lib/email", () => ({ sendTemplateEmail }));

import type { NextRequest } from "next/server";
import { prismaMock } from "@/test/db";
import { makeParty } from "@/test/factories";
import { SigningError } from "@/lib/signingService";
import { POST } from "./route";

const reqWith = (body: unknown = { reason: "x" }): NextRequest =>
  ({ headers: { get: () => null }, json: async () => body }) as unknown as NextRequest;

const params = { params: Promise.resolve({ token: "tok" }) };

async function runAfters() {
  const cbs = [...afterCallbacks];
  afterCallbacks.length = 0;
  for (const cb of cbs) await cb();
}

beforeEach(() => {
  declineProposal.mockReset();
  sendTemplateEmail.mockClear();
  afterCallbacks.length = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaMock.party.findFirst.mockResolvedValue(makeParty({ name: "Jane" }) as any);
});

describe("decline route — admin email is gated on firstDecline (RSL-32)", () => {
  it("sends the declined_admin email exactly once on a first decline", async () => {
    declineProposal.mockResolvedValue({ proposalId: "p1", firstDecline: true });

    const res = await POST(reqWith(), params);
    await runAfters();

    expect(sendTemplateEmail).toHaveBeenCalledTimes(1);
    expect(sendTemplateEmail.mock.calls[0][0]).toBe("declined_admin");
    expect(await res.json()).toMatchObject({ ok: true, redirectUrl: "/sign/tok/declined" });
  });

  it("does NOT send a second admin email on a repeat decline", async () => {
    declineProposal.mockResolvedValue({ proposalId: "p1", firstDecline: false });

    const res = await POST(reqWith(), params);
    await runAfters();

    expect(sendTemplateEmail).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ ok: true, redirectUrl: "/sign/tok/declined" });
  });

  it("maps a SigningError to a 422 with its code", async () => {
    declineProposal.mockRejectedValue(new SigningError("declined", "Decline not available"));

    const res = await POST(reqWith(), params);

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "declined" });
  });
});
