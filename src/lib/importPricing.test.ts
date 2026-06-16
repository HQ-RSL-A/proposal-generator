import { describe, expect, test } from "vitest";
import { inferFlatPricingFromImport } from "@/lib/importPricing";

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
