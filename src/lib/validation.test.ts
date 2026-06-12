import { describe, expect, it } from "vitest";
import {
  normalizeImportedTokens,
  paymentConfigSchema,
  partiesSchema,
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
