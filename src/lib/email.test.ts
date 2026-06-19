import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/audit", () => ({ logEvent: vi.fn(async () => {}) }));

const { enqueueJob } = vi.hoisted(() => ({ enqueueJob: vi.fn(async () => ({ id: "job_id" })) }));
vi.mock("@/lib/jobs", () => ({ enqueueJob }));

// Capture the options arg of Resend's send (idempotency key lives there).
// Resend must be a real constructable class — getResend() does `new Resend(key)`.
const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(async (..._args: unknown[]) => ({ data: { id: "re_1" }, error: null })),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { prismaMock } from "@/test/db";
import { makeEmailLog, makeProposal } from "@/test/factories";
import { sendTemplateEmail } from "@/lib/email";

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  sendMock.mockClear();
  sendMock.mockResolvedValue({ data: { id: "re_1" }, error: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaMock.proposal.findUniqueOrThrow.mockResolvedValue({ ...makeProposal({ id: "p1" }), parties: [] } as any);
  prismaMock.emailLog.create.mockResolvedValue(makeEmailLog({ id: "log1" }));
  prismaMock.emailLog.update.mockResolvedValue(makeEmailLog({ id: "log1" }));
});

describe("sendTemplateEmail idempotency key (RSL-28)", () => {
  it("uses a supplied idempotencyKey instead of the default emaillog-<id>", async () => {
    await sendTemplateEmail(
      "payment_received_admin",
      "p1",
      null,
      { amountCents: 5000 },
      undefined,
      "emailkey-evt_x-payment_failed_client"
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][1]).toEqual({
      idempotencyKey: "emailkey-evt_x-payment_failed_client",
    });
  });

  it("falls back to emaillog-<id> when no idempotencyKey is supplied", async () => {
    await sendTemplateEmail("payment_received_admin", "p1", null, { amountCents: 5000 });

    expect(sendMock.mock.calls[0][1]).toEqual({ idempotencyKey: "emaillog-log1" });
  });
});
