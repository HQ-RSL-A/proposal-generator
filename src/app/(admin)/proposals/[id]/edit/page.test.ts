import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");
const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/authGuard", () => ({ requireUser }));
vi.mock("@/components/proposals/proposalForm", () => ({ ProposalForm: () => null }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));

import { prismaMock } from "@/test/db";
import EditProposalPage from "./page";

beforeEach(() => {
  requireUser.mockReset();
});

describe("EditProposalPage (RSL-26 per-page guard, not just the layout)", () => {
  it("re-validates the user before any prisma fetch", async () => {
    // An unauthenticated / deactivated user makes requireUser redirect (throw) — the page's own
    // draft fetch must never run on the strength of the layout guard alone.
    requireUser.mockRejectedValue(new Error("REDIRECT"));

    await expect(EditProposalPage({ params: Promise.resolve({ id: "p1" }) })).rejects.toThrow();
    expect(prismaMock.proposal.findUnique).not.toHaveBeenCalled();
  });
});
