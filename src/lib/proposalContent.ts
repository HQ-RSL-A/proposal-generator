// Single source of truth for proposal content. Both the web renderer
// (ProposalView) and the PDF renderer (ProposalPdf) consume this structure,
// which guarantees the signed PDF shows exactly what the signer saw.

import type {
  AddOn,
  FrozenContent,
  FutureItem,
  OneTimeItem,
  PaymentConfig,
  RecurringItem,
  TierConfig,
  TokensJson,
  TrackRecordCaseStudy,
  TrackRecordConfig,
} from "@/lib/types";
import { effectiveLineItems, isManualInvoice, isSignOnly } from "@/lib/types";
import { clientFullName, collapseNameFieldGap } from "@/lib/clientName";
import {
  parseMsa,
  replaceTokensInBlocks,
  type MsaBlock,
} from "@/lib/parseMsa";
import {
  TRACK_RECORD_DISCLAIMER,
  TRACK_RECORD_HEADING,
  resolveTrackRecord,
} from "@/lib/trackRecord";

/**
 * A numbered fine-print note. Sections carry a `noteNumber` superscript marker
 * and the full text lives in the Notes block at the end of the proposal,
 * product-page style. Web markers scroll to the note; the PDF uses internal
 * link destinations.
 */
export interface ProposalNote {
  id: string;
  number: number;
  text: string;
}

/** Payment schedule when a deposit is taken: deposit now, balance + retainer later. */
export interface DepositScheduleInfo {
  depositPercent: number;
  /** Precise once an effective one-time build fee is known (flat, or a tier is selected). */
  depositAmountCents: number | null;
  remainingCents: number | null;
  deferredRecurring: RecurringItem | null;
}

/**
 * Resolves the deposit payment schedule for display. Mirrors the deposit branch of
 * effectiveCheckout but returns nullable amounts so the pre-selection tiered view can
 * still say "a deposit applies" before the client picks a tier.
 */
export function computeDepositSchedule(
  config: PaymentConfig,
  selectedTierId: string | null
): DepositScheduleInfo | null {
  if (!config.deposit) return null;
  const pct = config.deposit.depositPercent;
  const { oneTime, recurring } = effectiveLineItems(config, selectedTierId);
  if (oneTime && oneTime.amountCents > 0) {
    const depositAmountCents = Math.round((oneTime.amountCents * pct) / 100);
    return {
      depositPercent: pct,
      depositAmountCents,
      remainingCents: oneTime.amountCents - depositAmountCents,
      deferredRecurring: recurring,
    };
  }
  const tiered = Boolean(config.tiers && config.tiers.length > 0);
  // Tiered + browsing: a deposit applies to whichever tier carries the build fee.
  if (tiered && !selectedTierId) {
    return {
      depositPercent: pct,
      depositAmountCents: null,
      remainingCents: null,
      deferredRecurring: null,
    };
  }
  // Flat with no build fee, or a selected tier with no build fee: deposit does not apply.
  return null;
}

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
  trackRecord: {
    heading: string;
    intro: string;
    caseStudies: TrackRecordCaseStudy[];
    noteNumber: number;
  } | null;
  scope: {
    heading: string;
    intro: string;
    items: string[];
    outro: string;
    noteNumber: number;
  };
  timeline: {
    heading: string;
    intro: string;
    items: string[];
    outro: string;
    noteNumber: number;
  };
  investment: {
    heading: string;
    note: string;
    details: string;
    /** Flat (non-tier) charged lines. Rendered structurally only when one carries a discount. */
    flatOneTime: OneTimeItem | null;
    flatRecurring: RecurringItem | null;
    tiers: TierConfig[] | null;
    addOns: AddOn[] | null;
    futureItems: FutureItem[] | null;
    depositSchedule: DepositScheduleInfo | null;
    noteNumber: number;
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
  /** Numbered fine print collected from the sections above. */
  notes: ProposalNote[];
  /** The "Agreed and Accepted" block at the end of the MSA (second signing place). */
  execution: { heading: string; text: string };
  msa: { heading: string; preparedFor: string; blocks: MsaBlock[] };
}

/**
 * "• item\n• item" or plain newline lists -> string[]. A dash-family marker (-, –, —) is only
 * stripped when followed by whitespace, so a leading minus on a priced term (e.g. "-5% rush
 * surcharge") is never mistaken for a bullet and sign-flipped; the bullet glyph "•" is
 * unambiguous and strips with or without a trailing space (RSL-25).
 */
export function splitBulletString(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*(?:•\s*|[-–—]\s+)/, "").trim())
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
  trackRecord: TrackRecordConfig;
  msaBodyMarkdown: string;
  /** When known (post-sign, or a live tier pick), resolves exact deposit amounts. */
  selectedTierId?: string | null;
}): ProposalSections {
  const { tokens, paymentConfig, trackRecord, msaBodyMarkdown, selectedTierId = null } = input;
  const clientFull = clientFullName(tokens["Client.FirstName"], tokens["Client.LastName"]);
  const clientLine = `${clientFull}, ${tokens["Client.Company"]}`;

  // When the optional last name is blank, suppress the spacing gap its empty merge leaves in the
  // MSA party line (e.g. "Christian , Co" -> "Christian, Co"). No change to the agreement wording.
  const lastNameBlank = tokens["Client.LastName"].trim().length === 0;
  const rawMsaBlocks = replaceTokensInBlocks(
    parseMsa(msaBodyMarkdown),
    tokens as unknown as Record<string, string>
  );
  // A blank optional last name leaves a "First , Company" gap on the MSA party line. Collapse it
  // ONLY on the run carrying that exact artifact — never document-wide, which would silently
  // rewrite attorney-owned punctuation spacing / double spaces elsewhere in the agreement (RSL-31).
  const firstName = tokens["Client.FirstName"].trim();
  const isPartyGap = (text: string) => firstName.length > 0 && text.includes(`${firstName} ,`);
  const msaBlocks = lastNameBlank
    ? rawMsaBlocks.map((block) =>
        block.type === "heading"
          ? isPartyGap(block.text)
            ? { ...block, text: collapseNameFieldGap(block.text) }
            : block
          : {
              ...block,
              runs: block.runs.map((run) =>
                isPartyGap(run.text) ? { ...run, text: collapseNameFieldGap(run.text) } : run
              ),
            }
      )
    : rawMsaBlocks;

  const signOnly = isSignOnly(paymentConfig);
  const depositSchedule = computeDepositSchedule(paymentConfig, selectedTierId);

  // Numbered in order of appearance in the document. The track-record disclaimer only exists
  // when that section is shown, so numbering is computed rather than hardcoded. The leading "*"
  // of the legacy footnote strings is dropped: markers are superscript numbers now.
  const trackRecordPresent = trackRecord.caseStudies.length > 0;
  const notes: ProposalNote[] = [];
  const addNote = (text: string): number => {
    const number = notes.length + 1;
    notes.push({ id: `note-${number}`, number, text: text.replace(/^\*/, "") });
    return number;
  };
  const trackRecordNoteNumber = trackRecordPresent ? addNote(TRACK_RECORD_DISCLAIMER) : 0;
  const scopeNoteNumber = addNote("This scope does not include items not explicitly listed above.");
  const timelineNoteNumber = addNote(
    "Ongoing monthly services (Ads, GBP Optimization, SEO) operate on a rolling basis and are not bound to fixed delivery dates. Fixed timelines above apply to project and build deliverables in this proposal."
  );
  const investmentNoteNumber = addNote(
    `This proposal and the pricing in it are valid until ${tokens["Client.ValidUntil"]}. After that date, pricing and availability may change.`
  );

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
    trackRecord: trackRecordPresent
      ? {
          heading: TRACK_RECORD_HEADING,
          intro: trackRecord.intro,
          caseStudies: trackRecord.caseStudies,
          noteNumber: trackRecordNoteNumber,
        }
      : null,
    scope: {
      heading: "Scope of Work",
      intro: "Here's what you're getting:",
      items: splitBulletString(tokens["Client.ScopeItems"]),
      outro: "With your input and our execution, this gets done right.",
      noteNumber: scopeNoteNumber,
    },
    timeline: {
      heading: "Timelines",
      intro:
        "Here's what the timeline looks like. I'm building in a buffer because I'd rather deliver early than promise something I can't hit.",
      items: splitBulletString(tokens["Client.TimelineItems"]),
      outro:
        "I'd rather underpromise and overdeliver. This gives me the room to make sure every piece is done right.",
      noteNumber: timelineNoteNumber,
    },
    investment: {
      heading: "Your Investment",
      note: tokens["Client.InvestmentNote"],
      details: tokens["Client.InvestmentDetails"],
      flatOneTime: paymentConfig.oneTime,
      flatRecurring: paymentConfig.recurring,
      tiers: paymentConfig.tiers,
      addOns: paymentConfig.addOns ?? null,
      futureItems: paymentConfig.futureItems ?? null,
      depositSchedule,
      noteNumber: investmentNoteNumber,
    },
    howToProceed: {
      heading: "How to Proceed",
      intro: "Three steps and we're off:",
      steps: isManualInvoice(paymentConfig)
        ? [
            "Sign below. You adopt your signature once and place it in two spots, the proposal acceptance and the agreement execution.",
            "Once every party has signed, the agreement is in effect and your executed copy, signature certificate included, arrives by email.",
            "From there, we'll be in touch directly to get you started.",
          ]
        : signOnly
        ? [
            "Sign below. You adopt your signature once and place it in two spots, the proposal acceptance and the agreement execution.",
            "Within 24 hours, you'll receive the invoice or payment link for the first payment shown in Your Investment.",
            "As soon as that payment lands, you'll get a kickoff email with next steps and scheduling. Work begins right away.",
          ]
        : depositSchedule
          ? [
              "Sign below. You adopt your signature once and place it in two spots, the proposal acceptance and the agreement execution.",
              "Right after signing, you'll be taken to a secure checkout for the deposit shown in Your Investment.",
              "As soon as the deposit lands, work begins. The remaining balance is collected when the build is complete.",
            ]
          : [
              "Sign below. You adopt your signature once and place it in two spots, the proposal acceptance and the agreement execution.",
              "Right after signing, you'll be taken to a secure checkout for the first payment shown in Your Investment.",
              "As soon as that payment lands, you'll get a kickoff email with next steps and scheduling. Work begins right away.",
            ],
    },
    acceptance: {
      heading: "Acceptance",
      text: `By signing below, both parties agree to this Proposal and the attached Master Services Agreement, which together form one binding agreement. Your signature here accepts the Proposal, you place it once more at the end of the Agreement to execute it, and work begins once the first payment from ${tokens["Client.Company"]} has been received.`,
      clientName: clientFull,
      clientCompany: tokens["Client.Company"],
      rslaName: "Rahul Lalia",
      rslaTitle: "Managing Member, RSL/A LLC",
    },
    notes,
    execution: {
      heading: "Agreed and Accepted",
      text: "Executed by electronic signature. Pursuant to Section 37, this Agreement and the Proposal it accompanies form one binding agreement, and the signatures below execute both.",
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
  msaBodyMarkdown: string,
  selectedTierId: string | null = null
): ProposalSections {
  return buildProposalSections({
    tokens: frozen.tokens,
    paymentConfig: frozen.paymentConfig,
    trackRecord: resolveTrackRecord(frozen.trackRecord),
    msaBodyMarkdown,
    selectedTierId,
  });
}
