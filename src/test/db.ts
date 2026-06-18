// Prisma mock handle for integration-style tests (route handlers, server
// actions, the job queue). Usage in a test file:
//
//   import { vi } from "vitest";
//   vi.mock("@/lib/prisma");            // hoisted; swaps in src/lib/__mocks__/prisma.ts
//   import { prismaMock } from "@/test/db";
//
//   prismaMock.proposal.findUnique.mockResolvedValue(makeProposal({ ... }));
//
// `prismaMock` is the same object app code imports as `prisma`, so programming
// it here controls what the code under test sees. It auto-resets before each test.
import { beforeEach } from "vitest";
import { mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});
