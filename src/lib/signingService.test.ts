import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma");

const { gateToken } = vi.hoisted(() => ({ gateToken: vi.fn() }));
vi.mock("@/lib/partyTokens", () => ({
  gateToken,
  rotatePartyToken: vi.fn(async () => "rawtoken"),
}));

const { findOrCreateCustomer, createCheckoutSession, retrieveSession } = vi.hoisted(() => ({
  findOrCreateCustomer: vi.fn(async () => ({ id: "cus_1" })),
  createCheckoutSession: vi.fn(async (_input: { idempotencyKey: string }) => ({
    id: "cs_new",
    url: "https://checkout/new",
  })),
  retrieveSession: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({ findOrCreateCustomer, createCheckoutSession, retrieveSession }));

const { logEvent } = vi.hoisted(() => ({
  logEvent: vi.fn(async (_input: { eventType: string }) => {}),
}));
vi.mock("@/lib/audit", () => ({ logEvent }));

const { putPrivate } = vi.hoisted(() => ({
  putPrivate: vi.fn(async (_pathname: string, _data: Buffer, _contentType: string) => ({
    url: "https://blob/sig.png",
    pathname: "p",
  })),
}));
vi.mock("@/lib/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/blob")>()),
  putPrivate,
}));

import type { Proposal, ProposalStatus } from "@/generated/prisma/client";
import type { PaymentConfig } from "@/lib/types";
import { prismaMock } from "@/test/db";
import { makeParty, makeProposal } from "@/test/factories";
import {
  declineProposal,
  ensureCheckoutSession,
  frozenPaymentConfig,
  SigningError,
  submitSignature,
  type SignSubmission,
} from "@/lib/signingService";

const VALID_FLAT: PaymentConfig = {
  currency: "usd",
  paymentMethods: ["card"],
  oneTime: { amountCents: 500000, displayString: "$5,000", label: "Build" },
  recurring: null,
  tiers: null,
  preferAch: false,
};

/** Double-cast an object onto a Prisma Json column field. */
const asJson = (v: unknown) => v as unknown as Proposal["paymentConfig"];

function validPngDataUrl(): string {
  const buf = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(300),
  ]);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function baseSubmission(over: Partial<SignSubmission> = {}): SignSubmission {
  return {
    rawToken: "tok",
    signatureType: "DRAWN",
    signaturePngDataUrl: validPngDataUrl(),
    adoptedName: "Jane Client",
    signerTitle: "CEO",
    signerCompany: "Brightline Test Co",
    fontFamily: null,
    esignConsent: true,
    selectedTierId: null,
    selectedAddOnIds: [],
    stampedProposalAt: null,
    stampedAgreementAt: null,
    ipAddress: "1.2.3.4",
    userAgent: "test-agent",
    ...over,
  };
}

/** Proposal + included parties, as ensureCheckoutSession's findUniqueOrThrow returns it. */
function payable(over: Partial<Proposal> = {}) {
  const proposal = makeProposal({
    id: "p1",
    paymentStatus: "AWAITING",
    stripeCheckoutSessionId: null,
    frozenContent: null,
    paymentConfig: asJson(VALID_FLAT),
    selectedTierId: null,
    ...over,
  });
  return {
    ...proposal,
    parties: [makeParty({ id: "payer1", proposalId: "p1", role: "CLIENT_SIGNER", payer: true })],
  };
}

/** Programs the full happy path for a last-signer submitSignature. */
function programSign() {
  const base = payable();
  const party = { ...base.parties[0], signedAt: null, proposal: base };
  gateToken.mockResolvedValue({ ok: true, party });
  prismaMock.$transaction.mockImplementation(
    ((cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)) as never
  );
  prismaMock.party.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.signature.create.mockResolvedValue({} as never);
  prismaMock.party.count.mockResolvedValue(0); // last signer -> all signed
  prismaMock.proposal.update.mockResolvedValue({} as never);
  prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(base as never);
  prismaMock.auditEvent.count.mockResolvedValue(0);
  return { base, party };
}

beforeEach(() => {
  gateToken.mockReset();
  findOrCreateCustomer.mockClear();
  createCheckoutSession.mockClear();
  createCheckoutSession.mockResolvedValue({ id: "cs_new", url: "https://checkout/new" });
  retrieveSession.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue(undefined);
  putPrivate.mockClear();
  putPrivate.mockResolvedValue({ url: "https://blob/sig.png", pathname: "p" });
});

describe("frozenPaymentConfig — validate shape on read (RSL-21)", () => {
  it("throws a handled config_error for non-array tiers, not a raw TypeError", () => {
    const proposal = makeProposal({
      frozenContent: null,
      paymentConfig: asJson({ ...VALID_FLAT, tiers: "oops" }),
    });
    let caught: unknown;
    try {
      frozenPaymentConfig(proposal);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SigningError);
    expect((caught as SigningError).code).toBe("config_error");
  });

  it("returns a valid config unchanged", () => {
    const proposal = makeProposal({ frozenContent: null, paymentConfig: asJson(VALID_FLAT) });
    expect(frozenPaymentConfig(proposal)).toEqual(VALID_FLAT);
  });
});

describe("submitSignature — post-commit failures don't reject a committed sign (RSL-9)", () => {
  it("returns success even when post-commit audit writes throw; checkout still builds", async () => {
    programSign();
    // Every audit write except the checkout one fails.
    logEvent.mockImplementation(async (input: { eventType: string }) => {
      if (input.eventType !== "CHECKOUT_CREATED") throw new Error("audit down");
    });

    const result = await submitSignature(baseSubmission());

    expect(result.allSigned).toBe(true);
    expect(result.checkoutUrl).toBe("https://checkout/new");
    expect(prismaMock.signature.create).toHaveBeenCalledOnce(); // the sign committed
  });

  it("returns success with no checkout url (recoverable) when the checkout build throws", async () => {
    programSign();
    createCheckoutSession.mockRejectedValue(new Error("stripe down"));

    const result = await submitSignature(baseSubmission());

    expect(result).toMatchObject({ allSigned: true, checkoutUrl: null });
    expect(prismaMock.signature.create).toHaveBeenCalledOnce();
  });
});

describe("submitSignature — unique signature blob key (RSL-10)", () => {
  it("writes a per-submit key, never the fixed {partyId}.png that could be overwritten", async () => {
    programSign();
    await submitSignature(baseSubmission());
    await submitSignature(baseSubmission());

    const key1 = putPrivate.mock.calls[0][0];
    const key2 = putPrivate.mock.calls[1][0];

    expect(key1).not.toBe("proposals/p1/signatures/payer1.png"); // not the fixed key
    expect(key1).not.toBe(key2); // unique per submit -> no last-writer-wins overwrite
    expect(key1).toMatch(/^proposals\/p1\/signatures\/payer1-.+\.png$/);
  });
});

describe("ensureCheckoutSession — reuse-or-refuse + stable key (RSL-7)", () => {
  it("refuses to mint a new session when the proposal is already PAID", async () => {
    prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(payable({ paymentStatus: "PAID" }) as never);
    await expect(ensureCheckoutSession("p1", "tok")).rejects.toThrow();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses to duplicate a session that is already complete (webhook-lag window)", async () => {
    prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(
      payable({ stripeCheckoutSessionId: "cs_old" }) as never
    );
    retrieveSession.mockResolvedValue({ status: "complete", url: null } as never);
    await expect(ensureCheckoutSession("p1", "tok")).rejects.toThrow();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("reuses a still-open session", async () => {
    prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(
      payable({ stripeCheckoutSessionId: "cs_open" }) as never
    );
    retrieveSession.mockResolvedValue({ status: "open", url: "https://checkout/open" } as never);
    await expect(ensureCheckoutSession("p1", "tok")).resolves.toBe("https://checkout/open");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("derives the idempotency key from stable inputs only (no session id)", async () => {
    prismaMock.proposal.findUniqueOrThrow.mockResolvedValue(payable() as never);
    prismaMock.auditEvent.count.mockResolvedValue(0);
    prismaMock.proposal.update.mockResolvedValue({} as never);

    await ensureCheckoutSession("p1", "tok");

    expect(createCheckoutSession).toHaveBeenCalledOnce();
    const key = createCheckoutSession.mock.calls[0][0].idempotencyKey;
    expect(key).toBe("checkout-p1-g0");
    expect(key).not.toContain("cs_");
  });
});

describe("declineProposal — committed signature blocks a backward decline (RSL-20)", () => {
  function programDecline(status: ProposalStatus) {
    const proposal = makeProposal({ id: "p1", status });
    const party = { ...makeParty({ id: "party1", proposalId: "p1", signedAt: null }), proposal };
    gateToken.mockResolvedValue({ ok: true, party });
    prismaMock.$transaction.mockImplementation(
      ((cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)) as never
    );
    prismaMock.party.update.mockResolvedValue({} as never);
    prismaMock.proposal.updateMany.mockResolvedValue({ count: status === "PARTIALLY_SIGNED" ? 0 : 1 });
  }

  it("records the party decline but does NOT revert a PARTIALLY_SIGNED proposal", async () => {
    programDecline("PARTIALLY_SIGNED");
    await declineProposal({ rawToken: "tok", reason: "changed mind", ipAddress: null, userAgent: null });

    expect(prismaMock.party.update).toHaveBeenCalledOnce(); // decline is recorded
    const where = (prismaMock.proposal.updateMany.mock.calls[0][0] as { where: { status: unknown } })
      .where;
    expect(where.status).toEqual({ in: ["SENT", "VIEWED"] }); // gate excludes PARTIALLY_SIGNED
  });

  it("moves a SENT proposal to DECLINED", async () => {
    programDecline("SENT");
    await declineProposal({ rawToken: "tok", reason: null, ipAddress: null, userAgent: null });

    const call = prismaMock.proposal.updateMany.mock.calls[0][0] as {
      where: { status: unknown };
      data: { status: string };
    };
    expect(call.data.status).toBe("DECLINED");
    expect(call.where.status).toEqual({ in: ["SENT", "VIEWED"] });
  });
});
