import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth }));

import { prismaMock } from "@/test/db";
import { getActiveApiUser } from "./authGuard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userRow = (over: Record<string, unknown> = {}): any => ({
  id: "u1",
  email: "rahul@rsla.io",
  name: "Rahul",
  role: "ADMIN",
  active: true,
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: new Date(),
  ...over,
});

beforeEach(() => {
  auth.mockReset();
});

describe("getActiveApiUser (RSL-11 per-request active re-check)", () => {
  it("returns null for a non-@rsla.io session", async () => {
    auth.mockResolvedValue({ user: { email: "outsider@gmail.com" } });
    expect(await getActiveApiUser()).toBeNull();
  });

  it("returns null when the user row no longer exists (offboarded)", async () => {
    auth.mockResolvedValue({ user: { email: "ghost@rsla.io" } });
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await getActiveApiUser()).toBeNull();
  });

  it("returns null when the user is deactivated", async () => {
    auth.mockResolvedValue({ user: { email: "ex@rsla.io" } });
    prismaMock.user.findUnique.mockResolvedValue(userRow({ active: false }));
    expect(await getActiveApiUser()).toBeNull();
  });

  it("returns the live user when active and allowlisted", async () => {
    auth.mockResolvedValue({ user: { email: "rahul@rsla.io" } });
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    expect((await getActiveApiUser())?.email).toBe("rahul@rsla.io");
  });
});
