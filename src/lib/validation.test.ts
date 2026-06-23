import { describe, expect, it } from "vitest";
import {
  normalizeImportedTokens,
  paymentConfigSchema,
  partiesSchema,
  trackRecordConfigSchema,
  validatePaymentConfigForSend,
} from "@/lib/validation";
import type { PaymentConfig } from "@/lib/types";

const scorpionFixture = {
  "Client.ProposalTitle": "Multi-Channel Marketing System for Scorpion Junk Removal",
  "Client.FirstName": "Dominique",
  "Client.LastName": "Norris",
  "Client.Company": "Scorpion Junk Removal",
  "Client.ProblemTitle": "Inconsistent Lead Flow",
  "Client.ProblemText": "Problem paragraph one.\n\nProblem paragraph two.",
  "Client.SolutionTitle": "Flexible Monthly Marketing",
  "Client.SolutionText": "Solution text.",
  "Client.AtGlanceServices": "Website + rotating service",
  "Client.AtGlanceInvestment": "$997 + $497/month",
  "Client.AtGlanceTimeline": "2-3 weeks to launch",
  "Client.ScopeItems": "• Website rebuild\n• Monthly service",
  "Client.TimelineItems": "• Launch in 3 weeks",
  "Client.InvestmentDetails": "One-time Website Development: $997\nMonthly: $497",
  "Client.InvestmentNote": "11-month commitment.",
  "Document.CreatedDate": "March 10, 2026",
  // Client.ValidUntil intentionally missing (older skill output)
  "Client.CaseStudy": "legacy extra key that should be dropped",
};

describe("normalizeImportedTokens", () => {
  it("accepts real skill output, fills ValidUntil, drops extras", () => {
    const { tokens, errors } = normalizeImportedTokens(scorpionFixture);
    expect(errors).toEqual([]);
    expect(tokens).not.toBeNull();
    expect(tokens!["Client.ValidUntil"]).toMatch(/\w+ \d{1,2}, \d{4}/);
    expect((tokens as unknown as Record<string, string>)["Client.CaseStudy"]).toBeUndefined();
  });
  it("rejects missing required fields", () => {
    const { tokens, errors } = normalizeImportedTokens({ "Client.FirstName": "X" });
    expect(tokens).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
  it("rejects non-objects", () => {
    expect(normalizeImportedTokens("nope").tokens).toBeNull();
  });

  it("accepts an empty last name (optional)", () => {
    const { tokens, errors } = normalizeImportedTokens({ ...scorpionFixture, "Client.LastName": "" });
    expect(errors).toEqual([]);
    expect(tokens!["Client.LastName"]).toBe("");
  });

  it("accepts a missing last name (optional)", () => {
    const withoutLast: Record<string, unknown> = { ...scorpionFixture };
    delete withoutLast["Client.LastName"];
    const { tokens, errors } = normalizeImportedTokens(withoutLast);
    expect(errors).toEqual([]);
    expect(tokens!["Client.LastName"]).toBe("");
  });

  it("still rejects an empty first name", () => {
    expect(normalizeImportedTokens({ ...scorpionFixture, "Client.FirstName": "" }).tokens).toBeNull();
  });
});

const flatConfig: PaymentConfig = {
  currency: "usd",
  paymentMethods: ["card"],
  oneTime: { amountCents: 99700, displayString: "$997", label: "Website build" },
  recurring: {
    amountCents: 49700,
    displayString: "$497/month",
    label: "Monthly service",
    intervalMonths: 1,
  },
  tiers: null,
  preferAch: false,
};

describe("paymentConfigSchema", () => {
  it("accepts flat one-time + recurring", () => {
    expect(paymentConfigSchema.safeParse(flatConfig).success).toBe(true);
  });
  it("rejects flat + tiers together", () => {
    const bad = {
      ...flatConfig,
      tiers: [
        { id: "a", label: "A", recommended: false, includes: [], oneTime: flatConfig.oneTime, recurring: null },
        { id: "b", label: "B", recommended: true, includes: [], oneTime: flatConfig.oneTime, recurring: null },
      ],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a tier with no amounts", () => {
    const bad = {
      ...flatConfig,
      oneTime: null,
      recurring: null,
      tiers: [
        { id: "a", label: "A", recommended: false, includes: [], oneTime: null, recurring: null },
        { id: "b", label: "B", recommended: true, includes: [], oneTime: flatConfig.oneTime, recurring: null },
      ],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects duplicate recommended tiers", () => {
    const bad = {
      ...flatConfig,
      oneTime: null,
      recurring: null,
      tiers: [
        { id: "a", label: "A", recommended: true, includes: [], oneTime: flatConfig.oneTime, recurring: null },
        { id: "b", label: "B", recommended: true, includes: [], oneTime: flatConfig.oneTime, recurring: null },
      ],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });
  it("accepts sign-only (all null)", () => {
    const signOnly = { ...flatConfig, oneTime: null, recurring: null, tiers: null };
    expect(paymentConfigSchema.safeParse(signOnly).success).toBe(true);
  });
});

describe("validatePaymentConfigForSend", () => {
  it("passes when display matches cents", () => {
    expect(validatePaymentConfigForSend(flatConfig)).toEqual([]);
  });
  it("catches display/cents drift", () => {
    const drifted = {
      ...flatConfig,
      oneTime: { ...flatConfig.oneTime!, amountCents: 99600 },
    };
    const errors = validatePaymentConfigForSend(drifted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("$997");
  });
});

describe("paymentConfigSchema add-ons and deposit", () => {
  const tieredWithBuild: PaymentConfig = {
    currency: "usd",
    paymentMethods: ["card"],
    oneTime: null,
    recurring: null,
    tiers: [
      { id: "tier-a", label: "A", recommended: false, includes: [], oneTime: { amountCents: 400000, displayString: "$4,000", label: "Build" }, recurring: null },
      { id: "tier-b", label: "B", recommended: true, includes: [], oneTime: null, recurring: { amountCents: 50000, displayString: "$500/month", label: "Retainer", intervalMonths: 1 } },
    ],
    preferAch: false,
  };

  it("accepts add-ons (one-time + recurring)", () => {
    const ok = {
      ...flatConfig,
      addOns: [
        { id: "addon-logo", label: "Logo", displayString: "$800", amountCents: 80000, intervalMonths: null },
        { id: "addon-seo", label: "SEO", displayString: "$500/month", amountCents: 50000, intervalMonths: 1 },
      ],
    };
    expect(paymentConfigSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects duplicate add-on ids", () => {
    const bad = {
      ...flatConfig,
      addOns: [
        { id: "dup", label: "A", displayString: "$1", amountCents: 100, intervalMonths: null },
        { id: "dup", label: "B", displayString: "$2", amountCents: 200, intervalMonths: null },
      ],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an add-on with non-positive cents", () => {
    const bad = {
      ...flatConfig,
      addOns: [{ id: "addon-zero", label: "Zero", displayString: "$0", amountCents: 0, intervalMonths: null }],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a deposit when a flat one-time exists", () => {
    expect(paymentConfigSchema.safeParse({ ...flatConfig, deposit: { depositPercent: 50 } }).success).toBe(true);
  });

  it("accepts a deposit when at least one tier has a one-time", () => {
    expect(paymentConfigSchema.safeParse({ ...tieredWithBuild, deposit: { depositPercent: 50 } }).success).toBe(true);
  });

  it("rejects a deposit with no one-time anywhere", () => {
    const recurringOnly: PaymentConfig = { ...flatConfig, oneTime: null, deposit: { depositPercent: 50 } };
    expect(paymentConfigSchema.safeParse(recurringOnly).success).toBe(false);
  });

  it("rejects a deposit percent out of range", () => {
    expect(paymentConfigSchema.safeParse({ ...flatConfig, deposit: { depositPercent: 0 } }).success).toBe(false);
    expect(paymentConfigSchema.safeParse({ ...flatConfig, deposit: { depositPercent: 100 } }).success).toBe(false);
  });

  it("validatePaymentConfigForSend catches add-on display/cents drift", () => {
    const drifted = {
      ...flatConfig,
      addOns: [{ id: "addon-logo", label: "Logo", displayString: "$800", amountCents: 90000, intervalMonths: null }],
    } as PaymentConfig;
    const errors = validatePaymentConfigForSend(drifted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("$800");
  });
});

describe("paymentConfigSchema future items (display-only)", () => {
  const futureItems = [
    { id: "future-seo", label: "Monthly SEO", displayString: "$1,500/month", amountCents: 150000, intervalMonths: 1, startsNote: "After launch" },
    { id: "future-ads", label: "Ad management", displayString: "$2,000", amountCents: 200000, intervalMonths: null, startsNote: "Phase 2" },
  ];

  it("accepts well-formed future items", () => {
    expect(paymentConfigSchema.safeParse({ ...flatConfig, futureItems }).success).toBe(true);
  });

  it("rejects duplicate future item ids", () => {
    const bad = {
      ...flatConfig,
      futureItems: [
        { id: "dup", label: "A", displayString: "$1", amountCents: 100, intervalMonths: null, startsNote: "later" },
        { id: "dup", label: "B", displayString: "$2", amountCents: 200, intervalMonths: null, startsNote: "later" },
      ],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a future item with a blank startsNote", () => {
    const bad = {
      ...flatConfig,
      futureItems: [{ id: "future-x", label: "X", displayString: "$1", amountCents: 100, intervalMonths: null, startsNote: "" }],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("validatePaymentConfigForSend catches future-item display/cents drift", () => {
    const drifted = {
      ...flatConfig,
      futureItems: [{ id: "future-seo", label: "Monthly SEO", displayString: "$1,500/month", amountCents: 160000, intervalMonths: 1, startsNote: "After launch" }],
    } as PaymentConfig;
    const errors = validatePaymentConfigForSend(drifted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("$1,500");
  });
});

describe("paymentConfigSchema discounts", () => {
  const withDiscount = (discount: unknown): PaymentConfig =>
    ({ ...flatConfig, oneTime: { ...flatConfig.oneTime!, discount } }) as PaymentConfig;

  it("accepts a valid per-line discount", () => {
    expect(
      paymentConfigSchema.safeParse(withDiscount({ amountCents: 10000, reason: "Loyalty" })).success
    ).toBe(true);
  });

  it("accepts a null or absent discount", () => {
    expect(paymentConfigSchema.safeParse(withDiscount(null)).success).toBe(true);
    expect(paymentConfigSchema.safeParse(flatConfig).success).toBe(true);
  });

  it("rejects a zero or negative discount amount", () => {
    expect(paymentConfigSchema.safeParse(withDiscount({ amountCents: 0, reason: "x" })).success).toBe(
      false
    );
    expect(
      paymentConfigSchema.safeParse(withDiscount({ amountCents: -100, reason: "x" })).success
    ).toBe(false);
  });

  it("rejects a discount with no reason", () => {
    expect(
      paymentConfigSchema.safeParse(withDiscount({ amountCents: 10000, reason: "" })).success
    ).toBe(false);
  });

  it("send-time validation passes when displayString equals the net amount", () => {
    // net stays $997 (the discount only records the saving), so the display still matches.
    expect(validatePaymentConfigForSend(withDiscount({ amountCents: 10000, reason: "Loyalty" }))).toEqual(
      []
    );
  });

  it("rejects a discounted line whose net is zero (net-positive invariant, RSL-38)", () => {
    const zeroNet = { ...flatConfig, oneTime: { ...flatConfig.oneTime!, amountCents: 0, discount: { amountCents: 99700, reason: "All of it" } } };
    expect(paymentConfigSchema.safeParse(zeroNet).success).toBe(false);
  });
});

describe("validatePaymentConfigForSend Stripe minimum floor (RSL-30)", () => {
  it("blocks a deposit percent that drops the deposit below 50c", async () => {
    const config = {
      ...flatConfig,
      oneTime: { amountCents: 900, displayString: "$9", label: "Build" },
      recurring: null,
      deposit: { depositPercent: 5 }, // 5% of $9 = 45c < 50c
    } as PaymentConfig;
    const errors = validatePaymentConfigForSend(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("minimum");
    expect(errors[0]).toContain("Build");
  });

  it("blocks a discounted line whose net is below 50c", async () => {
    const config = {
      ...flatConfig,
      oneTime: {
        amountCents: 40,
        displayString: "$0.40",
        label: "Tiny build",
        discount: { amountCents: 9960, reason: "Loyalty" },
      },
      recurring: null,
    } as PaymentConfig;
    const errors = validatePaymentConfigForSend(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Tiny build");
  });

  it("blocks a charged add-on below 50c", async () => {
    const config = {
      ...flatConfig,
      oneTime: null,
      recurring: null,
      addOns: [{ id: "tiny", label: "Tiny", displayString: "$0.40", amountCents: 40, intervalMonths: null }],
    } as PaymentConfig;
    const errors = validatePaymentConfigForSend(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Tiny");
  });

  it("does NOT block a sub-50c future item (never charged)", async () => {
    const config = {
      ...flatConfig,
      futureItems: [
        { id: "f", label: "Future", displayString: "$0.25", amountCents: 25, intervalMonths: null, startsNote: "later" },
      ],
    } as PaymentConfig;
    expect(validatePaymentConfigForSend(config)).toEqual([]);
  });

  it("blocks each tier's deposit-derived first line independently", async () => {
    const config = {
      currency: "usd",
      paymentMethods: ["card"],
      oneTime: null,
      recurring: null,
      preferAch: false,
      deposit: { depositPercent: 5 },
      tiers: [
        { id: "a", label: "Starter", recommended: false, includes: [], oneTime: { amountCents: 900, displayString: "$9", label: "A build" }, recurring: null },
        { id: "b", label: "Pro", recommended: true, includes: [], oneTime: { amountCents: 400000, displayString: "$4,000", label: "B build" }, recurring: null },
      ],
    } as PaymentConfig;
    const errors = validatePaymentConfigForSend(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("A build");
  });

  it("passes a valid config with a healthy deposit", async () => {
    expect(validatePaymentConfigForSend({ ...flatConfig, deposit: { depositPercent: 50 } } as PaymentConfig)).toEqual([]);
  });

  it("passes a deposit that rounds to exactly 50c", async () => {
    const config = {
      ...flatConfig,
      oneTime: { amountCents: 100, displayString: "$1", label: "Build" },
      recurring: null,
      deposit: { depositPercent: 50 }, // 50% of $1 = 50c, exactly at the floor
    } as PaymentConfig;
    expect(validatePaymentConfigForSend(config)).toEqual([]);
  });
});

describe("validatePaymentConfigForSend manual invoice", () => {
  it("skips the Stripe floor for a sub-50c line when manualInvoice is on (nothing is charged)", () => {
    const base = {
      ...flatConfig,
      oneTime: { amountCents: 40, displayString: "$0.40", label: "Tiny build" },
      recurring: null,
    } as PaymentConfig;
    // Without the flag this would be blocked by the $0.50 floor...
    expect(validatePaymentConfigForSend(base)).toHaveLength(1);
    // ...with it, the floor doesn't apply because no Stripe charge ever happens.
    expect(validatePaymentConfigForSend({ ...base, manualInvoice: true })).toEqual([]);
  });

  it("still enforces display<->cents integrity when manualInvoice is on", () => {
    const drifted = {
      ...flatConfig,
      oneTime: { amountCents: 500000, displayString: "$4,000", label: "Build" },
      recurring: null,
      manualInvoice: true,
    } as PaymentConfig;
    const errors = validatePaymentConfigForSend(drifted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Build");
  });
});

describe("trackRecordConfigSchema", () => {
  it("accepts an intro plus case studies with and without a URL", () => {
    const ok = {
      intro: "We build systems for service businesses.",
      caseStudies: [
        { text: "A restaurant tripled its reviews.", href: "https://rsla.io/work/a" },
        { text: "A salon 60x'd its ad spend.", href: "" },
      ],
    };
    expect(trackRecordConfigSchema.safeParse(ok).success).toBe(true);
  });

  it("accepts an empty config (hidden section)", () => {
    expect(trackRecordConfigSchema.safeParse({ intro: "", caseStudies: [] }).success).toBe(true);
  });

  it("rejects a case study with empty text", () => {
    const bad = { intro: "", caseStudies: [{ text: "", href: "https://rsla.io" }] };
    expect(trackRecordConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-URL link", () => {
    const bad = { intro: "", caseStudies: [{ text: "A result", href: "not a url" }] };
    expect(trackRecordConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects more than six case studies", () => {
    const many = {
      intro: "",
      caseStudies: Array.from({ length: 7 }, (_, i) => ({ text: `Result ${i}`, href: "" })),
    };
    expect(trackRecordConfigSchema.safeParse(many).success).toBe(false);
  });
});

describe("input length caps (RSL-36)", () => {
  it("rejects a line label longer than the Stripe-safe cap", () => {
    const longLabel = "x".repeat(201);
    const bad = { ...flatConfig, oneTime: { ...flatConfig.oneTime!, label: longLabel } };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a line label at the cap", () => {
    const maxLabel = "x".repeat(200);
    const ok = { ...flatConfig, oneTime: { ...flatConfig.oneTime!, label: maxLabel } };
    expect(paymentConfigSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects an add-on label longer than the cap", () => {
    const bad = {
      ...flatConfig,
      addOns: [{ id: "a1", label: "y".repeat(201), displayString: "$10", amountCents: 1000, intervalMonths: null }],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a proposal title longer than the cap", () => {
    const longTitle = "x".repeat(201);
    const { tokens, errors } = normalizeImportedTokens({ ...scorpionFixture, "Client.ProposalTitle": longTitle });
    expect(tokens).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("partiesSchema", () => {
  it("requires exactly one payer", () => {
    expect(
      partiesSchema.safeParse([
        { name: "A", email: "a@x.com", payer: true },
        { name: "B", email: "b@x.com", payer: true },
      ]).success
    ).toBe(false);
    expect(
      partiesSchema.safeParse([
        { name: "A", email: "a@x.com", payer: true },
        { name: "B", email: "b@x.com", payer: false },
      ]).success
    ).toBe(true);
  });
  it("rejects duplicate emails (case-insensitive)", () => {
    expect(
      partiesSchema.safeParse([
        { name: "A", email: "A@x.com", payer: true },
        { name: "B", email: "a@x.com", payer: false },
      ]).success
    ).toBe(false);
  });
});
