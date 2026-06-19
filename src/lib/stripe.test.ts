import { describe, expect, it } from "vitest";
import { buildLineItems } from "@/lib/stripe";
import { effectiveCheckout, type PaymentConfig } from "@/lib/types";

const base: Pick<PaymentConfig, "currency" | "paymentMethods" | "preferAch"> = {
  currency: "usd",
  paymentMethods: ["card"],
  preferAch: false,
};

describe("buildLineItems", () => {
  it("uses the line label verbatim as the Stripe product name and charges the net", () => {
    const config: PaymentConfig = {
      ...base,
      oneTime: {
        amountCents: 900000,
        displayString: "$9,000",
        label: "Website build",
        discount: { amountCents: 100000, reason: "Loyalty" },
      },
      recurring: null,
      tiers: null,
    };
    const items = buildLineItems(effectiveCheckout(config, null, []), "usd");
    expect(items).toHaveLength(1);
    const pd = items[0].price_data!;
    // Product name is exactly the label — no " · {proposalTitle}" suffix.
    expect(pd.product_data?.name).toBe("Website build");
    // unit_amount is the net; the discount is already baked into amountCents.
    expect(pd.unit_amount).toBe(900000);
    expect(pd.recurring).toBeUndefined();
  });

  it("maps recurring cadence (quarterly -> month x3)", () => {
    const config: PaymentConfig = {
      ...base,
      oneTime: null,
      recurring: {
        amountCents: 30000,
        displayString: "$300/quarter",
        label: "Retainer",
        intervalMonths: 3,
      },
      tiers: null,
    };
    const items = buildLineItems(effectiveCheckout(config, null, []), "usd");
    expect(items[0].price_data?.recurring).toEqual({ interval: "month", interval_count: 3 });
    expect(items[0].price_data?.product_data?.name).toBe("Retainer");
  });
});
