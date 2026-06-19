import { describe, expect, it } from "vitest";
import { effectiveCheckout, type AddOn, type PaymentConfig } from "@/lib/types";

const base: Pick<PaymentConfig, "currency" | "paymentMethods" | "preferAch"> = {
  currency: "usd",
  paymentMethods: ["card"],
  preferAch: false,
};

const addOns: AddOn[] = [
  { id: "addon-logo", label: "Logo", displayString: "$800", amountCents: 80000, intervalMonths: null },
  { id: "addon-seo", label: "SEO", displayString: "$500/month", amountCents: 50000, intervalMonths: 1 },
];

const flatBuild: PaymentConfig = {
  ...base,
  oneTime: { amountCents: 600000, displayString: "$6,000", label: "Website build" },
  recurring: null,
  tiers: null,
};

const flatBuildPlusRetainer: PaymentConfig = {
  ...base,
  oneTime: { amountCents: 600000, displayString: "$6,000", label: "Website build" },
  recurring: { amountCents: 50000, displayString: "$500/month", label: "Retainer", intervalMonths: 1 },
  tiers: null,
};

const tiered: PaymentConfig = {
  ...base,
  oneTime: null,
  recurring: null,
  tiers: [
    {
      id: "tier-a",
      label: "A",
      recommended: false,
      includes: [],
      oneTime: { amountCents: 400000, displayString: "$4,000", label: "Build" },
      recurring: { amountCents: 30000, displayString: "$300/month", label: "Retainer", intervalMonths: 1 },
    },
    {
      id: "tier-b",
      label: "B",
      recommended: true,
      includes: [],
      oneTime: null,
      recurring: { amountCents: 50000, displayString: "$500/month", label: "Retainer", intervalMonths: 1 },
    },
  ],
};

describe("effectiveCheckout", () => {
  it("flat one-time, no deposit, no add-ons", () => {
    const r = effectiveCheckout(flatBuild, null, []);
    expect(r.depositActive).toBe(false);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0]).toMatchObject({ amountCents: 600000, intervalMonths: null, isDeposit: false });
  });

  it("flat one-time + recurring stays two line items in subscription territory", () => {
    const r = effectiveCheckout(flatBuildPlusRetainer, null, []);
    expect(r.depositActive).toBe(false);
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems.some((li) => li.intervalMonths === 1)).toBe(true);
  });

  it("deposit 50% collapses to a single one-time deposit line", () => {
    const r = effectiveCheckout({ ...flatBuild, deposit: { depositPercent: 50 } }, null, []);
    expect(r.depositActive).toBe(true);
    expect(r.depositAmountCents).toBe(300000);
    expect(r.remainingAfterDepositCents).toBe(300000);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0]).toMatchObject({ amountCents: 300000, isDeposit: true, intervalMonths: null });
    expect(r.deferredRecurring).toBeNull();
  });

  it("deposit rounds half-cents and balances exactly", () => {
    const odd: PaymentConfig = {
      ...flatBuild,
      oneTime: { amountCents: 99999, displayString: "$999.99", label: "Build" },
      deposit: { depositPercent: 50 },
    };
    const r = effectiveCheckout(odd, null, []);
    expect(r.depositAmountCents).toBe(50000); // round(49999.5)
    expect(r.remainingAfterDepositCents).toBe(49999); // 99999 - 50000
    expect(r.depositAmountCents! + r.remainingAfterDepositCents!).toBe(99999);
  });

  it("deposit defers the retainer (no recurring line, payment mode stays)", () => {
    const r = effectiveCheckout({ ...flatBuildPlusRetainer, deposit: { depositPercent: 50 } }, null, []);
    expect(r.depositActive).toBe(true);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems.every((li) => li.intervalMonths === null)).toBe(true);
    expect(r.deferredRecurring?.amountCents).toBe(50000);
  });

  it("deposit charges one-time add-ons but defers recurring add-ons", () => {
    const r = effectiveCheckout(
      { ...flatBuild, deposit: { depositPercent: 50 }, addOns },
      null,
      ["addon-logo", "addon-seo"]
    );
    // deposit + one-time logo add-on; recurring SEO add-on deferred
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems.filter((li) => li.isAddOn)).toHaveLength(1);
    expect(r.lineItems.every((li) => li.intervalMonths === null)).toBe(true);
  });

  it("add-ons without deposit stack on the base", () => {
    const r = effectiveCheckout({ ...flatBuild, addOns }, null, ["addon-logo", "addon-seo"]);
    expect(r.depositActive).toBe(false);
    expect(r.lineItems).toHaveLength(3); // base one-time + 2 add-ons
    expect(r.lineItems.filter((li) => li.isAddOn)).toHaveLength(2);
    expect(r.lineItems.some((li) => li.intervalMonths === 1)).toBe(true);
  });

  it("ignores unknown add-on ids", () => {
    const r = effectiveCheckout({ ...flatBuild, addOns }, null, ["addon-nope"]);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems.some((li) => li.isAddOn)).toBe(false);
  });

  it("tiered: deposit applies to the selected tier's build fee", () => {
    const r = effectiveCheckout({ ...tiered, deposit: { depositPercent: 50 } }, "tier-a", []);
    expect(r.depositActive).toBe(true);
    expect(r.depositAmountCents).toBe(200000); // 50% of $4,000
    expect(r.deferredRecurring?.amountCents).toBe(30000);
  });

  it("tiered: deposit inactive when the selected tier has no build fee", () => {
    const r = effectiveCheckout({ ...tiered, deposit: { depositPercent: 50 } }, "tier-b", []);
    expect(r.depositActive).toBe(false);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0].intervalMonths).toBe(1); // charges the tier recurring normally
  });

  // Discounts are additive metadata: amountCents is already the net, so checkout charges the net
  // and never re-applies the discount. A discounted line and the equivalent plain-net line are
  // identical to the charge resolver.
  it("charges the net amountCents and ignores discount metadata", () => {
    const discounted: PaymentConfig = {
      ...flatBuild,
      oneTime: {
        amountCents: 900000,
        displayString: "$9,000",
        label: "Website build",
        discount: { amountCents: 100000, reason: "Loyalty" },
      },
    };
    const plainNet: PaymentConfig = {
      ...flatBuild,
      oneTime: { amountCents: 900000, displayString: "$9,000", label: "Website build" },
    };
    const a = effectiveCheckout(discounted, null, []);
    const b = effectiveCheckout(plainNet, null, []);
    expect(a.lineItems.map((li) => li.amountCents)).toEqual(b.lineItems.map((li) => li.amountCents));
    expect(a.lineItems[0].amountCents).toBe(900000);
  });

  it("deposit % applies to the net (post-discount) one-time", () => {
    const discounted: PaymentConfig = {
      ...flatBuild,
      oneTime: {
        amountCents: 900000,
        displayString: "$9,000",
        label: "Build",
        discount: { amountCents: 100000, reason: "Loyalty" },
      },
      deposit: { depositPercent: 50 },
    };
    const r = effectiveCheckout(discounted, null, []);
    expect(r.depositAmountCents).toBe(450000); // 50% of the net $9,000, not the $10,000 list
  });

  it("never bills a discounted future item", () => {
    const withFuture: PaymentConfig = {
      ...flatBuild,
      futureItems: [
        {
          id: "future-seo",
          label: "Monthly SEO",
          displayString: "$1,500/month",
          amountCents: 150000,
          intervalMonths: 1,
          startsNote: "After launch",
          discount: { amountCents: 50000, reason: "Intro rate" },
        },
      ],
    };
    const r = effectiveCheckout(withFuture, null, []);
    expect(r.lineItems).toHaveLength(1); // just the build fee — discounted future item excluded
  });

  // Invariant guard: display-only future items must NEVER reach checkout, by construction.
  it("never bills display-only future items", () => {
    const withFuture: PaymentConfig = {
      ...flatBuild,
      futureItems: [
        {
          id: "future-seo",
          label: "Monthly SEO",
          displayString: "$1,500/month",
          amountCents: 150000,
          intervalMonths: 1,
          startsNote: "After launch",
        },
      ],
    };
    const r = effectiveCheckout(withFuture, null, []);
    expect(r.lineItems).toHaveLength(1); // just the build fee — future item excluded
    expect(r.lineItems.some((li) => li.amountCents === 150000)).toBe(false);
  });
});
