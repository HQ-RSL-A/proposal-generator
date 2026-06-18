// Track Record section content.
//
// Per-proposal now: each proposal stores its own intro + case studies (TrackRecordConfig in
// types.ts), frozen at send. The heading and the results-vary disclaimer stay fixed across every
// proposal. The SUGGESTED_* values are reference data only — they seed the form's "Load suggested
// examples" button, the /docs example, and the test token. LEGACY_TRACK_RECORD is the fallback for
// proposals sent before per-proposal track record existed (and any row with no stored value), so
// nothing already in flight changes.

import type { TrackRecordCaseStudy, TrackRecordConfig } from "@/lib/types";

export const TRACK_RECORD_HEADING = "Our Track Record";

export const TRACK_RECORD_DISCLAIMER =
  "*Results vary by industry, market, and client involvement. These examples reflect real outcomes but are not a guarantee of specific results for your engagement.";

/** Largest number of case studies a single proposal can carry. */
export const MAX_CASE_STUDIES = 6;

export const SUGGESTED_INTRO =
  "We build marketing infrastructure for service businesses. Healthcare, construction, food service, professional services, and many more. Everything we build is designed to run on its own with minimal upkeep.";

export const SUGGESTED_CASE_STUDIES: TrackRecordCaseStudy[] = [
  {
    text: "A local restaurant went from 14 to 132 Google reviews in 60 days. That translated to $25K in new revenue.",
    href: "https://rsla.io/work/local-seo-reputation-management",
  },
  {
    text: "A salon owner in Manhattan put $600 into Meta ads and pulled $36K in income within 3 months. 60X return.",
    href: "https://rsla.io/work/salon-marketing-automation-roi",
  },
  {
    text: "On the SEO side, we rebuilt a software company's site and repositioned their search strategy. Six months later, they were #1 on Google for 7+ keywords with 20+ top 3 rankings.",
    href: "https://rsla.io/work/fieldshare-seo-website-rebrand",
  },
];

/** New drafts start here. An explicit empty config hides the section (and its disclaimer note). */
export const EMPTY_TRACK_RECORD: TrackRecordConfig = { intro: "", caseStudies: [] };

/**
 * Shown for proposals that predate per-proposal track record (frozen content without the field)
 * and any row whose trackRecord is null. Keeps already-sent documents visually unchanged.
 */
export const LEGACY_TRACK_RECORD: TrackRecordConfig = {
  intro: SUGGESTED_INTRO,
  caseStudies: SUGGESTED_CASE_STUDIES,
};

/**
 * Resolves a stored or frozen track-record value to a concrete config.
 * null/undefined (legacy or pre-migration) -> the legacy 3; an explicit object (even empty) is
 * respected as the author's choice, so an empty config hides the section.
 */
export function resolveTrackRecord(value: unknown): TrackRecordConfig {
  if (value == null) return LEGACY_TRACK_RECORD;
  // Validate the shape on read (RSL-21): a malformed/partial frozen value (e.g.
  // one missing its caseStudies array) must not crash the document render at
  // `trackRecord.caseStudies.length`. Fall back to the legacy default instead.
  if (
    typeof value === "object" &&
    typeof (value as { intro?: unknown }).intro === "string" &&
    Array.isArray((value as { caseStudies?: unknown }).caseStudies)
  ) {
    return value as TrackRecordConfig;
  }
  return LEGACY_TRACK_RECORD;
}
