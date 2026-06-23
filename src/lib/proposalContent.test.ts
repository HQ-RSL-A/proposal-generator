import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildProposalSections, splitBulletString, splitParagraphs } from "@/lib/proposalContent";
import { LEGACY_TRACK_RECORD, resolveTrackRecord } from "@/lib/trackRecord";
import type { PaymentConfig, TokensJson, TrackRecordConfig } from "@/lib/types";

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

const trackRecord: TrackRecordConfig = {
  intro: "We build systems for service businesses.",
  caseStudies: [
    { text: "A restaurant tripled its reviews.", href: "https://rsla.io/work/a" },
    { text: "A salon 60x'd its ad spend.", href: "" },
  ],
};
const emptyTrackRecord: TrackRecordConfig = { intro: "", caseStudies: [] };

describe("splitBulletString", () => {
  it("handles •, -, and – prefixes", () => {
    expect(splitBulletString("• a\n- b\n– c\nplain")).toEqual(["a", "b", "c", "plain"]);
  });
  it("drops empty lines", () => {
    expect(splitBulletString("• a\n\n• b")).toEqual(["a", "b"]);
  });
  it("keeps a leading minus on a priced term (RSL-25)", () => {
    // "-5%" is a signed amount, not a bullet — stripping the minus sign-flips a legal term.
    expect(splitBulletString("-5% rush surcharge")).toEqual(["-5% rush surcharge"]);
  });
  it("treats em-dash bullets the same as en-dash bullets (RSL-25)", () => {
    expect(splitBulletString("— a\n– b")).toEqual(["a", "b"]);
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
      trackRecord,
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

  it("renders first name + company when the last name is blank", () => {
    const sections = buildProposalSections({
      tokens: { ...tokens, "Client.LastName": "" },
      paymentConfig: paidConfig,
      trackRecord,
      msaBodyMarkdown: msa,
    });
    expect(sections.cover.subtitle).toContain("Dominique, Scorpion Junk Removal");
    expect(sections.cover.subtitle).not.toContain("Dominique ,");
    const msaText = JSON.stringify(sections.msa.blocks);
    expect(msaText).toContain("Dominique, Scorpion Junk Removal");
    expect(msaText).not.toContain("Dominique ,");
    expect(msaText).not.toContain("{{Client.");
  });

  it("renders the MSA body byte-identical whether or not the surname is blank (RSL-31)", () => {
    const synthMsa = [
      "## Agreement",
      "",
      '**{{Client.FirstName}} {{Client.LastName}}, {{Client.Company}} (the "Client").**',
      "",
      "The parties  agree as follows.",
      "",
      "Fees are due on receipt ; no exceptions.",
    ].join("\n");

    const withSurname = buildProposalSections({
      tokens,
      paymentConfig: paidConfig,
      trackRecord,
      msaBodyMarkdown: synthMsa,
    });
    const blankSurname = buildProposalSections({
      tokens: { ...tokens, "Client.LastName": "" },
      paymentConfig: paidConfig,
      trackRecord,
      msaBodyMarkdown: synthMsa,
    });

    // Attorney body text — an intentional double space and a space before a semicolon — must
    // survive in BOTH renders. The bug ran a document-wide regex for a blank surname and
    // silently rewrote this legally-binding text.
    for (const sections of [withSurname, blankSurname]) {
      const body = JSON.stringify(sections.msa.blocks);
      expect(body).toContain("The parties  agree as follows.");
      expect(body).toContain("receipt ; no exceptions.");
    }

    // Every non-party block is identical between the two renders (only the party line may differ).
    const bodyBlocks = (s: typeof withSurname) =>
      s.msa.blocks.filter((b) => !JSON.stringify(b).includes("Scorpion"));
    expect(bodyBlocks(blankSurname)).toEqual(bodyBlocks(withSurname));

    // ...and the party line itself is still correctly de-gapped for the blank surname.
    const partyRun = blankSurname.msa.blocks
      .flatMap((b) => (b.type === "heading" ? [] : b.runs))
      .find((r) => r.text.includes("Scorpion"));
    expect(partyRun?.text).toBe('Dominique, Scorpion Junk Removal (the "Client").');
    expect(partyRun?.text).not.toContain("Dominique ,");
  });

  it("does not throw when the Client.LastName key is absent entirely (RSL-39)", () => {
    const withoutLast = { ...tokens } as Record<string, unknown>;
    delete withoutLast["Client.LastName"];
    expect(() =>
      buildProposalSections({
        tokens: withoutLast as TokensJson,
        paymentConfig: paidConfig,
        trackRecord,
        msaBodyMarkdown: msa,
      })
    ).not.toThrow();
  });

  it("adapts How to Proceed copy to the payment mode", () => {
    const paid = buildProposalSections({ tokens, paymentConfig: paidConfig, trackRecord, msaBodyMarkdown: msa });
    const signOnly = buildProposalSections({
      tokens,
      paymentConfig: signOnlyConfig,
      trackRecord,
      msaBodyMarkdown: msa,
    });
    expect(paid.howToProceed.steps[1]).toContain("secure checkout");
    expect(signOnly.howToProceed.steps[1]).toContain("invoice or payment link");
  });

  it("shows the track record section and disclaimer note when case studies exist", () => {
    const sections = buildProposalSections({
      tokens,
      paymentConfig: paidConfig,
      trackRecord,
      msaBodyMarkdown: msa,
    });
    expect(sections.trackRecord).not.toBeNull();
    expect(sections.trackRecord?.noteNumber).toBe(1);
    expect(sections.trackRecord?.caseStudies).toHaveLength(2);
    expect(sections.notes).toHaveLength(4);
    expect(sections.notes[0].text).toContain("Results vary");
    expect(sections.scope.noteNumber).toBe(2);
  });

  it("hides the track record and renumbers notes when there are no case studies", () => {
    const sections = buildProposalSections({
      tokens,
      paymentConfig: paidConfig,
      trackRecord: emptyTrackRecord,
      msaBodyMarkdown: msa,
    });
    expect(sections.trackRecord).toBeNull();
    expect(sections.notes).toHaveLength(3);
    expect(sections.notes[0].text).not.toContain("Results vary");
    expect(sections.scope.noteNumber).toBe(1);
    expect(sections.timeline.noteNumber).toBe(2);
    expect(sections.investment.noteNumber).toBe(3);
    expect(sections.notes[2].text).toContain("July 11, 2026");
  });
});

describe("resolveTrackRecord", () => {
  it("falls back to the legacy case studies for null/undefined (pre-migration rows)", () => {
    expect(resolveTrackRecord(null)).toBe(LEGACY_TRACK_RECORD);
    expect(resolveTrackRecord(undefined)).toBe(LEGACY_TRACK_RECORD);
    expect(LEGACY_TRACK_RECORD.caseStudies.length).toBeGreaterThan(0);
  });
  it("respects an explicit, even empty, config", () => {
    const empty = { intro: "", caseStudies: [] };
    expect(resolveTrackRecord(empty)).toBe(empty);
  });
});
