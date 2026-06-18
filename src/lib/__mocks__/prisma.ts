// Manual mock for `@/lib/prisma`, picked up by `vi.mock("@/lib/prisma")`.
// A deep mock means every model + method (prisma.proposal.findUnique,
// prisma.$transaction, ...) is a vi.fn you can program per-test.
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";

export const prisma = mockDeep<PrismaClient>();
