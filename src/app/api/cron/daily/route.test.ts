import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/cronAuth", () => ({
  isAuthorizedCron: () => true,
  logCronRun: vi.fn(async () => {}),
}));
vi.mock("@/lib/audit", () => ({ logEvent: vi.fn(async () => {}) }));

const { sendTemplateEmail } = vi.hoisted(() => ({
  sendTemplateEmail: vi.fn<
    (t: string, p?: string, party?: string | null, ctx?: Record<string, unknown>) => Promise<{ ok: boolean }>
  >(async () => ({ ok: true })),
}));
vi.mock("@/lib/email", () => ({ sendTemplateEmail }));
const { rotatePartyToken } = vi.hoisted(() => ({ rotatePartyToken: vi.fn(async () => "rawtok") }));
vi.mock("@/lib/partyTokens", () => ({ rotatePartyToken }));

import type { NextRequest } from "next/server";
import { prismaMock } from "@/test/db";
import { makeEmailLog, makeParty, makeProposal } from "@/test/factories";
import { GET } from "./route";

const req = () => ({}) as unknown as NextRequest;

/** An open proposal `hoursLeft` from expiry, with one unsigned client signer. */
function openProposal(id: string, hoursLeft: number) {
  return {
    ...makeProposal({ id, status: "SENT", validUntil: new Date(Date.now() + hoursLeft * 3_600_000) }),
    parties: [makeParty({ id: `${id}-p`, role: "CLIENT_SIGNER", signedAt: null })],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const sentTemplates = () => sendTemplateEmail.mock.calls.map((c) => c[0]);

beforeEach(() => {
  sendTemplateEmail.mockClear();
  sendTemplateEmail.mockResolvedValue({ ok: true });
  prismaMock.$transaction.mockResolvedValue([]);
  prismaMock.auditEvent.findFirst.mockResolvedValue(null);
  prismaMock.emailLog.findFirst.mockResolvedValue(null);
});

describe("daily cron (RSL-16 resilience)", () => {
  it("still runs the reminder pass when an expiry-notice email fails", async () => {
    prismaMock.proposal.findMany
      .mockResolvedValueOnce([makeProposal({ id: "exp1", status: "SENT" })]) // expire pass
      .mockResolvedValueOnce([openProposal("open1", 12)]); // reminder pass (daysLeft = 1)
    sendTemplateEmail.mockImplementation(async (tpl: string) => {
      if (tpl === "expired_admin") throw new Error("resend is down");
      return { ok: true };
    });

    await GET(req());

    // One failed expiry notice must NOT abort the entire reminder pass.
    expect(sentTemplates()).toContain("signing_reminder");
  });

  it("sends the daysLeft=1 reminder even after a 3-day reminder already went out", async () => {
    prismaMock.proposal.findMany
      .mockResolvedValueOnce([]) // nothing to expire
      .mockResolvedValueOnce([openProposal("open1", 12)]); // daysLeft = 1
    // An earlier signing_reminder exists (the 3-day one) — the old templateId-only dedup ate the 1-day.
    prismaMock.emailLog.findFirst.mockResolvedValue(makeEmailLog({ templateId: "signing_reminder" }));
    prismaMock.auditEvent.findFirst.mockResolvedValue(null); // but no daysLeft=1 reminder yet

    await GET(req());

    expect(sentTemplates()).toContain("signing_reminder");
  });
});
