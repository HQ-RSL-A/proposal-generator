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
