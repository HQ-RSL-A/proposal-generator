// Smoke test for the Wave 0 test seam: proves the prisma deep mock can be
// programmed and is seen by code that imports `@/lib/prisma` the normal way,
// that it auto-resets between tests, and that the fixture factories build
// type-valid rows. If this is green, every payment/signing/queue/authz fix can
// get a real regression test.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");

import { prisma } from "@/lib/prisma";
import { prismaMock } from "@/test/db";
import { makeParty, makeProposal } from "@/test/factories";

describe("test seam", () => {
  it("programs the deep mock and reads it back through the app import", async () => {
    const proposal = makeProposal({ title: "Smoke Co" });
    prismaMock.proposal.findUnique.mockResolvedValue(proposal);

    // App code does exactly this: `import { prisma }` then call it.
    const got = await prisma.proposal.findUnique({ where: { id: proposal.id } });

    expect(got?.title).toBe("Smoke Co");
    expect(prismaMock.proposal.findUnique).toHaveBeenCalledOnce();
  });

  it("auto-resets the mock between tests", () => {
    // The call from the previous test must not leak into this one.
    expect(prismaMock.proposal.findUnique).not.toHaveBeenCalled();
  });

  it("factories build valid rows and honor overrides", () => {
    const payer = makeParty({ payer: true, email: "payer@example.com" });
    expect(payer.payer).toBe(true);
    expect(payer.email).toBe("payer@example.com");
    // Unset overrides fall back to complete defaults.
    expect(payer.role).toBe("CLIENT_SIGNER");
    expect(makeProposal().paymentStatus).toBe("AWAITING");
  });
});
