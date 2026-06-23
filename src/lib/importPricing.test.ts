import { describe, expect, it, test } from "vitest";
import { inferFlatPricingFromImport, summarizeImportedDiscounts } from "@/lib/importPricing";
import type { PaymentConfig } from "@/lib/types";

describe("inferFlatPricingFromImport", () => {
  test("maps the internal flat config shape (one-time + monthly) into pricing items", () => {
    const raw = {
      oneTime: { amountCents: 1370000, displayString: "$13,700", label: "One-time build" },
      recurring: {
        amountCents: 125000,
        displayString: "$1,250",
        label: "Monthly growth plan",
        intervalMonths: 1,
      },
      paymentMethods: ["card", "us_bank_account"],
      preferAch: true,
      tiers: null,
    };
    const result = inferFlatPricingFromImport(raw);
    expect(result).not.toBeNull();
    expect(result!.oneTime).toEqual({
      amountCents: 1370000,
      displayString: "$13,700",
      label: "One-time build",
    });
    expect(result!.recurring).toEqual({
      amountCents: 125000,
      displayString: "$1,250",
      label: "Monthly growth plan",
      intervalMonths: 1,
    });
    expect(result!.methods).toEqual({ card: true, ach: true });
    expect(result!.preferAch).toBe(true);
  });

  test("returns null when a tiers array is present (flat and tiers are mutually exclusive)", () => {
    const raw = {
      tiers: [{ id: "tier-growth" }],
      oneTime: { amountCents: 1000, displayString: "$10", label: "x" },
    };
    expect(inferFlatPricingFromImport(raw)).toBeNull();
  });

  test("returns null when neither a one-time nor a recurring amount is present", () => {
    const raw = { "Client.Company": "Valley Oak", paymentMethods: ["card"] };
    expect(inferFlatPricingFromImport(raw)).toBeNull();
  });

  test("preserves a quarterly interval and defaults an invalid interval to monthly", () => {
    const quarterly = inferFlatPricingFromImport({
      recurring: { amountCents: 90000, displayString: "$900", label: "Retainer", intervalMonths: 3 },
    });
    expect(quarterly!.recurring!.intervalMonths).toBe(3);
    const bad = inferFlatPricingFromImport({
      recurring: { amountCents: 90000, displayString: "$900", label: "Retainer", intervalMonths: 7 },
    });
    expect(bad!.recurring!.intervalMonths).toBe(1);
  });

  test("derives cents from the display string when amountCents is missing", () => {
    const result = inferFlatPricingFromImport({
      oneTime: { displayString: "$6,000", label: "Build" },
    });
    expect(result!.oneTime).toEqual({
      amountCents: 600000,
      displayString: "$6,000",
      label: "Build",
    });
  });

  test("ignores a non-positive or non-integer amountCents and falls back to the display string", () => {
    const negative = inferFlatPricingFromImport({
      oneTime: { amountCents: -5, displayString: "$2,000", label: "Build" },
    });
    expect(negative!.oneTime!.amountCents).toBe(200000);
    const fractional = inferFlatPricingFromImport({
      oneTime: { amountCents: 12.5, displayString: "$2,000", label: "Build" },
    });
    expect(fractional!.oneTime!.amountCents).toBe(200000);
  });

  test("drops a money line that has neither a valid amount nor a parseable display string", () => {
    const result = inferFlatPricingFromImport({
      oneTime: { displayString: "to be confirmed", label: "Build" },
      recurring: { amountCents: 125000, displayString: "$1,250", label: "Monthly", intervalMonths: 1 },
    });
    expect(result!.oneTime).toBeNull();
    expect(result!.recurring).not.toBeNull();
  });

  test("defaults labels when they are missing", () => {
    const result = inferFlatPricingFromImport({
      oneTime: { amountCents: 500000, displayString: "$5,000" },
      recurring: { amountCents: 100000, displayString: "$1,000", intervalMonths: 1 },
    });
    expect(result!.oneTime!.label).toBe("One-time build");
    expect(result!.recurring!.label).toBe("Monthly retainer");
  });

  test("omits methods and preferAch when the source does not specify them", () => {
    const result = inferFlatPricingFromImport({
      oneTime: { amountCents: 500000, displayString: "$5,000", label: "Build" },
    });
    expect(result!.methods).toBeNull();
    expect(result!.preferAch).toBeNull();
  });
});

describe("inferFlatPricingFromImport discounts (readDiscount, RSL-33)", () => {
  const withDiscount = (discount: unknown) =>
    inferFlatPricingFromImport({
      oneTime: { amountCents: 900000, displayString: "$9,000", label: "Build", discount },
    });

  test("carries a well-formed discount through to the pricing item", () => {
    expect(withDiscount({ amountCents: 100000, reason: "Loyalty" })!.oneTime!.discount).toEqual({
      amountCents: 100000,
      reason: "Loyalty",
    });
  });

  test("drops a discount with a non-positive or non-integer amount", () => {
    expect(withDiscount({ amountCents: 0, reason: "x" })!.oneTime!.discount).toBeUndefined();
    expect(withDiscount({ amountCents: 12.5, reason: "x" })!.oneTime!.discount).toBeUndefined();
  });

  test("drops a discount with a blank reason", () => {
    expect(withDiscount({ amountCents: 100000, reason: "   " })!.oneTime!.discount).toBeUndefined();
  });

  test("ignores a non-object discount", () => {
    expect(withDiscount("nope")!.oneTime!.discount).toBeUndefined();
  });
});

describe("summarizeImportedDiscounts (RSL-37)", () => {
  const base: Pick<PaymentConfig, "currency" | "paymentMethods" | "preferAch" | "tiers" | "recurring"> = {
    currency: "usd",
    paymentMethods: ["card"],
    preferAch: false,
    tiers: null,
    recurring: null,
  };

  it("returns a was/now/reason line per discounted charged line", () => {
    const config = {
      ...base,
      oneTime: { amountCents: 75000, displayString: "$750", label: "Setup", discount: { amountCents: 25000, reason: "Loyalty" } },
    } as PaymentConfig;
    expect(summarizeImportedDiscounts(config)).toEqual(["Setup: was $1,000, now $750 (Loyalty)"]);
  });

  it("returns an empty list when nothing is discounted", () => {
    const config = { ...base, oneTime: { amountCents: 75000, displayString: "$750", label: "Setup" } } as PaymentConfig;
    expect(summarizeImportedDiscounts(config)).toEqual([]);
  });

  it("includes a tier oneTime discount in the summary", () => {
    const tierConfig: PaymentConfig = {
      mode: "tiers",
      tiers: [{
        id: "t1",
        label: "Starter",
        recommended: false,
        includes: [],
        oneTime: {
          label: "Setup",
          amountCents: 100000,
          discount: { amountCents: 10000, reason: "Promo" },
        },
        recurring: null,
        addOns: [],
      }],
      oneTime: null,
      recurring: null,
      addOns: [],
      deposit: null,
      manualInvoice: null,
      trackRecord: null,
      futureItems: [],
    } as unknown as PaymentConfig;
    const summary = summarizeImportedDiscounts(tierConfig);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary[0]).toMatch(/Setup/);
    expect(summary[0]).toMatch(/Promo/);
  });

  it("includes an add-on discount in the summary", () => {
    const addOnConfig: PaymentConfig = {
      mode: "flat",
      tiers: null,
      oneTime: null,
      recurring: null,
      addOns: [{
        id: "ao1",
        label: "Extra Support",
        displayString: "$500/mo",
        amountCents: 50000,
        intervalMonths: 1,
        discount: { amountCents: 5000, reason: "Launch discount" },
      }],
      deposit: null,
      manualInvoice: null,
      trackRecord: null,
      futureItems: [],
    } as unknown as PaymentConfig;
    const summary = summarizeImportedDiscounts(addOnConfig);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary[0]).toMatch(/Extra Support/);
    expect(summary[0]).toMatch(/Launch discount/);
  });
});
