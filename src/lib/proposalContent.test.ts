import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildProposalSections, splitBulletString, splitParagraphs } from "@/lib/proposalContent";
import type { PaymentConfig, TokensJson } from "@/lib/types";

const msa = fs.readFileSync(path.join(__dirname, "../../prisma/content/msaV3.md"), "utf8");

const tokens: TokensJson = {
  "Client.ProposalTitle": "Test System",
  "Client.FirstName": "Dominique",
  "Client.LastName": "Norris",
  "Client.Company": "Scorpion Junk Removal",
  "Client.ProblemTitle": "The Problem",
  "Client.ProblemText": "Para one.\n\nPara two.",
  "Client.SolutionTitle": "The Solution",
  "Client.SolutionText": "Solution para.",
  "Client.AtGlanceServices": "Website",
  "Client.AtGlanceInvestment": "$997",
  "Client.AtGlanceTimeline": "3 weeks",
  "Client.ScopeItems": "• Item one\n• Item two\n- Item three",
  "Client.TimelineItems": "• Week 1",
  "Client.InvestmentDetails": "One-time: $997",
  "Client.InvestmentNote": "Payment due at signing.",
  "Document.CreatedDate": "June 11, 2026",
  "Client.ValidUntil": "July 11, 2026",
};

const signOnlyConfig: PaymentConfig = {
  currency: "usd",
  paymentMethods: ["card"],
  oneTime: null,
  recurring: null,
  tiers: null,
  preferAch: false,
};

const paidConfig: PaymentConfig = {
  ...signOnlyConfig,
  oneTime: { amountCents: 99700, displayString: "$997", label: "Build" },
};

describe("splitBulletString", () => {
  it("handles •, -, and – prefixes", () => {
    expect(splitBulletString("• a\n- b\n– c\nplain")).toEqual(["a", "b", "c", "plain"]);
  });
  it("drops empty lines", () => {
    expect(splitBulletString("• a\n\n• b")).toEqual(["a", "b"]);
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines", () => {
    expect(splitParagraphs("one\n\ntwo\n\n\nthree")).toEqual(["one", "two", "three"]);
  });
});

describe("buildProposalSections", () => {
  it("assembles every section with client data merged", () => {
    const sections = buildProposalSections({
      tokens,
      paymentConfig: paidConfig,
      msaBodyMarkdown: msa,
    });
    expect(sections.cover.title).toBe("Test System");
    expect(sections.cover.subtitle).toContain("Dominique Norris, Scorpion Junk Removal");
    expect(sections.atGlance.rows).toHaveLength(5);
    expect(sections.problem.greeting).toBe("Hi Dominique,");
    expect(sections.problem.paragraphs).toHaveLength(2);
    expect(sections.scope.items).toEqual(["Item one", "Item two", "Item three"]);
    expect(sections.notes).toHaveLength(4);
    expect(sections.notes[3].text).toContain("July 11, 2026");
    expect(sections.notes.every((note) => !note.text.startsWith("*"))).toBe(true);
    expect(sections.investment.noteNumber).toBe(4);
    expect(sections.execution.heading).toBe("Agreed and Accepted");
    expect(sections.acceptance.text).toContain("Scorpion Junk Removal");
    expect(sections.msa.blocks.filter((b) => b.type === "heading")).toHaveLength(37);
    // MSA tokens merged
    expect(JSON.stringify(sections.msa.blocks)).toContain("June 11, 2026");
    expect(JSON.stringify(sections.msa.blocks)).not.toContain("{{Client.");
  });

  it("adapts How to Proceed copy to the payment mode", () => {
    const paid = buildProposalSections({ tokens, paymentConfig: paidConfig, msaBodyMarkdown: msa });
    const signOnly = buildProposalSections({
      tokens,
      paymentConfig: signOnlyConfig,
      msaBodyMarkdown: msa,
    });
    expect(paid.howToProceed.steps[1]).toContain("secure checkout");
    expect(signOnly.howToProceed.steps[1]).toContain("invoice or payment link");
  });
});
