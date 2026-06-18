import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/blob", () => ({ fetchPrivateBlob: vi.fn(async () => Buffer.from("PDF-BYTES")) }));

import type { NextRequest } from "next/server";
import { prismaMock } from "@/test/db";
import { GET } from "./route";

const req = () => ({}) as unknown as NextRequest;
const ctx = { params: Promise.resolve({ id: "p1" }) };

beforeEach(() => {
  auth.mockReset();
});

describe("GET /api/proposals/[id]/pdf (RSL-11 deactivated-user revocation)", () => {
  it("401s a deactivated @rsla.io user and never reads the executed document", async () => {
    auth.mockResolvedValue({ user: { email: "ghost@rsla.io" } }); // valid JWT, but offboarded
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await GET(req(), ctx);

    expect(res.status).toBe(401);
    expect(prismaMock.generatedDocument.findFirst).not.toHaveBeenCalled();
  });
});
