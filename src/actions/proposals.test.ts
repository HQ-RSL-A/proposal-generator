import { beforeEach, describe, expect, it, vi } from "vitest";

// requireAuth/requireUser drive the actor role; the rest are mocked to isolate the actions
// (and to keep the @react-pdf chain behind jobRunner out of the import graph).
const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/authGuard", () => ({ requireAuth, requireUser: requireAuth }));
vi.mock("@/lib/prisma");
const { rotatePartyToken } = vi.hoisted(() => ({ rotatePartyToken: vi.fn(async () => "rawtok") }));
vi.mock("@/lib/partyTokens", () => ({ rotatePartyToken }));
const { sendTemplateEmail } = vi.hoisted(() => ({ sendTemplateEmail: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/email", () => ({ sendTemplateEmail, ADMIN_EMAIL: "lalia@rsla.io" }));
vi.mock("@/lib/audit", () => ({ logEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/jobs", () => ({ enqueueJob: vi.fn(async () => ({ id: "j" })), retryDeadJob: vi.fn(async () => {}) }));
vi.mock("@/lib/jobRunner", () => ({ runJobNow: vi.fn(async () => {}) }));
vi.mock("@/lib/blob", () => ({ blobPaths: {}, fetchPrivateBlob: vi.fn(), putPrivate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => void) => fn?.() }));

import { prismaMock } from "@/test/db";
import { getFreshSigningLink, remindParty, updatePartyEmail } from "./proposals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (v: unknown): any => v;
const member = asAny({ id: "m1", email: "member@rsla.io", role: "MEMBER", active: true });
const admin = asAny({ id: "a1", email: "rahul@rsla.io", role: "ADMIN", active: true });

beforeEach(() => {
  requireAuth.mockReset();
  requireAuth.mockResolvedValue(member);
  rotatePartyToken.mockClear();
  // A live, repointable party — so WITHOUT the gate the current code would proceed to the hijack.
  prismaMock.party.findUniqueOrThrow.mockResolvedValue(
    asAny({
      id: "party1",
      proposalId: "p1",
      name: "Real Client",
      email: "real@client.com",
      role: "CLIENT_SIGNER",
      signedAt: null,
      proposal: { status: "SENT", validUntil: null },
    })
  );
  prismaMock.party.update.mockResolvedValue(asAny({}));
});

describe("party actions (RSL-12 ADMIN gate)", () => {
  it("blocks a MEMBER from repointing a party email — no update, no token rotation", async () => {
    const res = await updatePartyEmail({ partyId: "party1", email: "attacker@evil.com", name: "X" });
    expect(res.ok).toBe(false);
    expect(prismaMock.party.update).not.toHaveBeenCalled();
    expect(rotatePartyToken).not.toHaveBeenCalled();
  });

  it("blocks a MEMBER from minting a fresh signing link", async () => {
    const res = await getFreshSigningLink("party1");
    expect(res.ok).toBe(false);
    expect(rotatePartyToken).not.toHaveBeenCalled();
  });

  it("blocks a MEMBER from sending a reminder", async () => {
    const res = await remindParty("party1");
    expect(res.ok).toBe(false);
    expect(rotatePartyToken).not.toHaveBeenCalled();
  });

  it("allows an ADMIN to repoint a party email", async () => {
    requireAuth.mockResolvedValue(admin);
    const res = await updatePartyEmail({ partyId: "party1", email: "real@client.com", name: "Real" });
    expect(res.ok).toBe(true);
    expect(rotatePartyToken).toHaveBeenCalledWith("party1");
  });
});
