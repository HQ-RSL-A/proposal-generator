import { describe, expect, it } from "vitest";
import { isManualInvoice, isSignOnly, skipsCheckout, type PaymentConfig } from "./types";

const base: PaymentConfig = {
  currency: "usd",
  paymentMethods: ["card"],
  oneTime: null,
  recurring: null,
  tiers: null,
  preferAch: false,
};

const flat: PaymentConfig = {
  ...base,
  oneTime: { amountCents: 100000, displayString: "$1,000", label: "Build" },
};

describe("pricing-mode helpers", () => {
  it("isSignOnly is true only when nothing is priced", () => {
    expect(isSignOnly(base)).toBe(true);
    expect(isSignOnly(flat)).toBe(false);
    expect(isSignOnly({ ...base, tiers: [] })).toBe(true);
  });

  it("isManualInvoice requires the flag AND real pricing", () => {
    expect(isManualInvoice({ ...flat, manualInvoice: true })).toBe(true);
    expect(isManualInvoice(flat)).toBe(false); // priced, flag off
    // Flag on but nothing priced -> degrades to plain sign-only, never a meaningless MANUAL_INVOICE.
    expect(isManualInvoice({ ...base, manualInvoice: true })).toBe(false);
  });

  it("skipsCheckout covers both sign-only and manual-invoice", () => {
    expect(skipsCheckout(base)).toBe(true); // sign-only
    expect(skipsCheckout(flat)).toBe(false); // priced -> charges
    expect(skipsCheckout({ ...flat, manualInvoice: true })).toBe(true); // priced but invoiced manually
  });
});
