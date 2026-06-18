// Pure dashboard aggregations: headline numbers, month-over-month deltas, 6-month
// sparkline series, attention detection, and table filters. The dashboard page does the
// Prisma -> NormalizedProposal extraction (reusing effectiveLineItems); everything here is
// plain arithmetic + date bucketing so it stays unit-testable with simple fixtures.

import type { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";

/** A proposal reduced to just what the dashboard metrics need. */
export interface NormalizedProposal {
  id: string;
  status: ProposalStatus;
  paymentStatus: PaymentStatus;
  sentAt: Date | null;
  /** When it reached SIGNED. */
  completedAt: Date | null;
  /** Effective one-time value (build fee + one-time add-ons), in cents. */
  oneTimeCents: number;
  /** Effective recurring revenue normalized to a monthly figure (see monthlyRecurringCents), in cents. */
  recurringMonthlyCents: number;
  company: string;
  title: string;
}

/** Live, client-facing statuses — the pipeline that can still be nudged. */
export const OPEN_STATUSES: ProposalStatus[] = ["SENT", "VIEWED", "PARTIALLY_SIGNED"];

/** Everything that reached a client and either resolved or is still live — the win-rate denominator. */
const DECIDED_STATUSES: ProposalStatus[] = [
  "SENT",
  "VIEWED",
  "PARTIALLY_SIGNED",
  "SIGNED",
  "DECLINED",
  "EXPIRED",
];

/** An open proposal older than this (in days) since it was sent needs a nudge. */
export const ATTENTION_AGE_DAYS = 14;

const DAY_MS = 86_400_000;

/** Normalize an amount billed every `intervalMonths` to a monthly figure: $300/quarter -> $100/mo,
 *  $12k/year -> $1,000/mo. A guard returns 0 for a non-positive interval. */
export function monthlyNormalizedCents(amountCents: number, intervalMonths: number): number {
  return intervalMonths > 0 ? Math.round(amountCents / intervalMonths) : 0;
}

/**
 * The single source of truth for MRR period-normalization (RSL-18): the monthly-normalized sum of
 * a recurring base line plus any recurring add-ons (1/3/12-month intervals all fold to monthly).
 * The dashboard page consumes this instead of re-deriving MRR in its mapper, so a non-monthly
 * retainer is never silently dropped to $0.
 */
export function monthlyRecurringCents(
  recurring: { amountCents: number; intervalMonths: number } | null,
  addOns: { amountCents: number; intervalMonths: number | null }[]
): number {
  const base = recurring ? monthlyNormalizedCents(recurring.amountCents, recurring.intervalMonths) : 0;
  const addOnMonthly = addOns
    .filter((a): a is { amountCents: number; intervalMonths: number } => a.intervalMonths != null)
    .reduce((sum, a) => sum + monthlyNormalizedCents(a.amountCents, a.intervalMonths), 0);
  return base + addOnMonthly;
}

export interface MonthBucket {
  /** First instant of the month (inclusive). */
  start: Date;
  /** First instant of the next month (exclusive). */
  end: Date;
  /** Short month label, e.g. "Jun". */
  label: string;
}

/** The last `count` calendar months ending with the month containing `now`, oldest first. */
export function monthlyBuckets(now: Date, count = 6): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    buckets.push({ start, end, label: start.toLocaleString("en-US", { month: "short" }) });
  }
  return buckets;
}

export type AttentionReason = "awaiting_payment" | "stale_open";

export interface AttentionItem {
  id: string;
  company: string;
  reason: AttentionReason;
  /** Days since sent — present for stale_open items. */
  ageDays?: number;
}

export interface DashboardMetrics {
  winRate: number;
  signedCount: number;
  decidedCount: number;
  contractedCents: number;
  mrrCents: number;
  /** Recurring revenue added this calendar month (= MRR this month-end minus last month-end). */
  mrrDeltaCents: number;
  signedThisMonth: number;
  signedLastMonth: number;
  avgSignMs: number | null;
  oldestOpenMs: number | null;
  /** Cumulative MRR stock at each of the last 6 month-ends. */
  mrrSeries: number[];
  /** Signings within each of the last 6 months. */
  signedSeries: number[];
  /** Mean sent->signed duration within each month; null where nothing was signed. */
  avgSignSeries: (number | null)[];
  attention: AttentionItem[];
}

export function computeDashboardMetrics(
  proposals: NormalizedProposal[],
  now: Date
): DashboardMetrics {
  const signed = proposals.filter((p) => p.status === "SIGNED");
  const signedCount = signed.length;
  const decidedCount = proposals.filter((p) => DECIDED_STATUSES.includes(p.status)).length;
  const winRate = decidedCount > 0 ? Math.round((signedCount / decidedCount) * 100) : 0;

  const contractedCents = signed.reduce((s, p) => s + p.oneTimeCents, 0);
  const mrrCents = signed.reduce((s, p) => s + p.recurringMonthlyCents, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const signedInMonth = (start: Date, end: Date | null) =>
    signed.filter(
      (p) => p.completedAt && p.completedAt >= start && (end === null || p.completedAt < end)
    );

  const signedThisMonth = signedInMonth(monthStart, null).length;
  const signedLastMonth = signedInMonth(lastMonthStart, monthStart).length;
  const mrrDeltaCents = signedInMonth(monthStart, null).reduce(
    (s, p) => s + p.recurringMonthlyCents,
    0
  );

  const signTimes = signed
    .filter((p) => p.completedAt && p.sentAt)
    .map((p) => p.completedAt!.getTime() - p.sentAt!.getTime());
  const avgSignMs = signTimes.length
    ? signTimes.reduce((a, b) => a + b, 0) / signTimes.length
    : null;

  const openWithSent = proposals.filter((p) => OPEN_STATUSES.includes(p.status) && p.sentAt);
  const oldestOpenMs = openWithSent.length
    ? Math.max(...openWithSent.map((p) => now.getTime() - p.sentAt!.getTime()))
    : null;

  const buckets = monthlyBuckets(now, 6);
  // Cumulative recurring stock through each month end, half-open (`< end`) so it agrees with
  // signedSeries: a deal signed exactly at a month boundary lands in the SAME month for both
  // (RSL-24). No `min(end, now)` is needed — completedAt is never in the future.
  const mrrSeries = buckets.map((b) =>
    signed
      .filter((p) => p.completedAt && p.completedAt.getTime() < b.end.getTime())
      .reduce((s, p) => s + p.recurringMonthlyCents, 0)
  );
  const signedSeries = buckets.map((b) => signedInMonth(b.start, b.end).length);
  const avgSignSeries = buckets.map((b) => {
    const times = signedInMonth(b.start, b.end)
      .filter((p) => p.sentAt)
      .map((p) => p.completedAt!.getTime() - p.sentAt!.getTime());
    return times.length ? times.reduce((a, c) => a + c, 0) / times.length : null;
  });

  const attention: AttentionItem[] = [];
  for (const p of proposals) {
    if (p.status === "SIGNED" && (p.paymentStatus === "AWAITING" || p.paymentStatus === "FAILED")) {
      attention.push({ id: p.id, company: p.company, reason: "awaiting_payment" });
    } else if (OPEN_STATUSES.includes(p.status) && p.sentAt) {
      // Continuous day comparison so the strip flags the deal the instant it crosses 14 days,
      // matching the headline's `oldestOpenMs > 14d` warn (RSL-24). `floor(days) > 14` lagged ~24h.
      const ageMs = now.getTime() - p.sentAt.getTime();
      if (ageMs > ATTENTION_AGE_DAYS * DAY_MS) {
        attention.push({ id: p.id, company: p.company, reason: "stale_open", ageDays: Math.floor(ageMs / DAY_MS) });
      }
    }
  }

  return {
    winRate,
    signedCount,
    decidedCount,
    contractedCents,
    mrrCents,
    mrrDeltaCents,
    signedThisMonth,
    signedLastMonth,
    avgSignMs,
    oldestOpenMs,
    mrrSeries,
    signedSeries,
    avgSignSeries,
    attention,
  };
}

/** A sparkline only renders with real signal: at least two non-zero data points. */
export function hasSparklineSignal(series: (number | null)[]): boolean {
  return series.filter((v) => v != null && v !== 0).length >= 2;
}

export type ProposalFilter = "all" | "open" | "signed" | "attention";

export interface FilterableRow {
  status: ProposalStatus;
  needsAttention: boolean;
}

export function rowMatchesFilter(row: FilterableRow, filter: ProposalFilter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return OPEN_STATUSES.includes(row.status);
  if (filter === "signed") return row.status === "SIGNED";
  return row.needsAttention; // "attention"
}

export function filterCounts(rows: FilterableRow[]): Record<ProposalFilter, number> {
  return {
    all: rows.length,
    open: rows.filter((r) => rowMatchesFilter(r, "open")).length,
    signed: rows.filter((r) => rowMatchesFilter(r, "signed")).length,
    attention: rows.filter((r) => rowMatchesFilter(r, "attention")).length,
  };
}
