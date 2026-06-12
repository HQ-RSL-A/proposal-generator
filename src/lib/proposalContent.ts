// Single source of truth for proposal content. Both the web renderer
// (ProposalView) and the PDF renderer (ProposalPdf) consume this structure,
// which guarantees the signed PDF shows exactly what the signer saw.

import type { FrozenContent, PaymentConfig, TierConfig, TokensJson } from "@/lib/types";
import { isSignOnly } from "@/lib/types";
import {
  parseMsa,
  replaceTokensInBlocks,
  type MsaBlock,
} from "@/lib/parseMsa";
import { TRACK_RECORD } from "@/lib/trackRecord";

export interface ProposalSections {
  cover: { title: string; subtitle: string };
  atGlance: { intro: string; rows: { label: string; value: string }[] };
  problem: {
    title: string;
    greeting: string;
    paragraphs: string[];
    contactLine: string;
    signOff: string[];
  };
  solution: { title: string; intro: string; paragraphs: string[]; outro: string };
  trackRecord: typeof TRACK_RECORD;
  scope: { heading: string; intro: string; items: string[]; outro: string; footnote: string };
  timeline: { heading: string; intro: string; items: string[]; outro: string; footnote: string };
  investment: {
    heading: string;
    note: string;
    details: string;
    tiers: TierConfig[] | null;
    footnote: string;
  };
  howToProceed: { heading: string; intro: string; steps: string[] };
  acceptance: {
    heading: string;
    text: string;
    clientName: string;
    clientCompany: string;
    rslaName: string;
    rslaTitle: string;
  };
  msa: { heading: string; preparedFor: string; blocks: MsaBlock[] };
}

/** "• item\n• item" or plain newline lists -> string[] */
export function splitBulletString(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*[•\-–]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

export function splitParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function buildProposalSections(input: {
  tokens: TokensJson;
  paymentConfig: PaymentConfig;
  msaBodyMarkdown: string;
}): ProposalSections {
  const { tokens, paymentConfig, msaBodyMarkdown } = input;
  const clientFull = `${tokens["Client.FirstName"]} ${tokens["Client.LastName"]}`;
  const clientLine = `${clientFull}, ${tokens["Client.Company"]}`;

  const msaBlocks = replaceTokensInBlocks(
    parseMsa(msaBodyMarkdown),
    tokens as unknown as Record<string, string>
  );

  const signOnly = isSignOnly(paymentConfig);

  return {
    cover: {
      title: tokens["Client.ProposalTitle"],
      subtitle: `This proposal contains all of the details & costs regarding the scope of work, investment, and terms requested by ${clientLine}`,
    },
    atGlance: {
      intro: "The short version. Every line below is broken down in the pages that follow.",
      rows: [
        { label: "Prepared for", value: clientLine },
        { label: "What we're building", value: tokens["Client.AtGlanceServices"] },
        { label: "Investment", value: tokens["Client.AtGlanceInvestment"] },
        { label: "Timeline", value: tokens["Client.AtGlanceTimeline"] },
        { label: "Proposal valid until", value: tokens["Client.ValidUntil"] },
      ],
    },
    problem: {
      title: tokens["Client.ProblemTitle"],
      greeting: `Hi ${tokens["Client.FirstName"]},`,
      paragraphs: splitParagraphs(tokens["Client.ProblemText"]),
      contactLine:
        "Below is the full breakdown of what I'm proposing, scope, timelines, and pricing. If you have any questions, reach out to me at +1 (646) 641-3173 or team@rsla.io",
      signOff: ["Thanks,", "Rahul L."],
    },
    solution: {
      title: tokens["Client.SolutionTitle"],
      intro: "Here's what I'd build for you.",
      paragraphs: splitParagraphs(tokens["Client.SolutionText"]),
      outro:
        "I've built systems like this before, and I know what works here. If I didn't, I wouldn't have put this proposal together.",
    },
    trackRecord: TRACK_RECORD,
    scope: {
      heading: "Scope of Work",
      intro: "Here's what you're getting:",
      items: splitBulletString(tokens["Client.ScopeItems"]),
      outro: "With your input and our execution, this gets done right.",
      footnote: "*This scope does not include items not explicitly listed above.",
    },
    timeline: {
      heading: "Timelines",
      intro:
        "Here's what the timeline looks like. I'm building in a buffer because I'd rather deliver early than promise something I can't hit.",
      items: splitBulletString(tokens["Client.TimelineItems"]),
      outro:
        "I'd rather underpromise and overdeliver. This gives me the room to make sure every piece is done right.",
      footnote:
        "*Ongoing monthly services (Ads, GBP Optimization, SEO) operate on a rolling basis and are not bound to fixed delivery dates. Fixed timelines above apply to project and build deliverables in this proposal.",
    },
    investment: {
      heading: "Your Investment",
      note: tokens["Client.InvestmentNote"],
      details: tokens["Client.InvestmentDetails"],
      tiers: paymentConfig.tiers,
      footnote: `*This proposal and the pricing in it are valid until ${tokens["Client.ValidUntil"]}. After that date, pricing and availability may change.`,
    },
    howToProceed: {
      heading: "How to Proceed",
      intro: "Three steps and we're off:",
      steps: signOnly
        ? [
            "Sign below. One signature covers this proposal and the attached Master Services Agreement.",
            "Within 24 hours, you'll receive the invoice or payment link for the first payment shown in Your Investment.",
            "As soon as that payment lands, you'll get a kickoff email with next steps and scheduling. Work begins right away.",
          ]
        : [
            "Sign below. One signature covers this proposal and the attached Master Services Agreement.",
            "Right after signing, you'll be taken to a secure checkout for the first payment shown in Your Investment.",
            "As soon as that payment lands, you'll get a kickoff email with next steps and scheduling. Work begins right away.",
          ],
    },
    acceptance: {
      heading: "Acceptance",
      text: `By signing below, both parties agree to this Proposal and the attached Master Services Agreement, which together form one binding agreement. This signature executes both documents, and work begins once the first payment from ${tokens["Client.Company"]} has been received.`,
      clientName: clientFull,
      clientCompany: tokens["Client.Company"],
      rslaName: "Rahul Lalia",
      rslaTitle: "Managing Member, RSL/A LLC",
    },
    msa: {
      heading: "Master Services Agreement",
      preparedFor: clientLine,
      blocks: msaBlocks,
    },
  };
}

export function sectionsFromFrozen(
  frozen: FrozenContent,
  msaBodyMarkdown: string
): ProposalSections {
  return buildProposalSections({
    tokens: frozen.tokens,
    paymentConfig: frozen.paymentConfig,
    msaBodyMarkdown,
  });
}
