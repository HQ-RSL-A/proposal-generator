import { describe, expect, it } from "vitest";
import {
  computeDashboardMetrics,
  filterCounts,
  hasSparklineSignal,
  monthlyBuckets,
  rowMatchesFilter,
  type NormalizedProposal,
} from "./dashboardMetrics";

const DAY = 86_400_000;

/** June 15 2026, noon, local time — matches the project's "today". */
const NOW = new Date(2026, 5, 15, 12, 0, 0);

function mk(over: Partial<NormalizedProposal>): NormalizedProposal {
  return {
    id: Math.random().toString(36).slice(2),
    status: "SIGNED",
    paymentStatus: "NOT_REQUIRED",
    sentAt: null,
    completedAt: null,
    oneTimeCents: 0,
    recurringMonthlyCents: 0,
    company: "Acme Co",
    title: "Some proposal",
    ...over,
  };
}

describe("monthlyBuckets", () => {
  it("returns `count` buckets ending with the month containing `now`, oldest first", () => {
    const buckets = monthlyBuckets(NOW, 6);
    expect(buckets).toHaveLength(6);
    expect(buckets.map((b) => b.label)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);

    const last = buckets[5];
    expect(last.start.getFullYear()).toBe(2026);
    expect(last.start.getMonth()).toBe(5); // June
    expect(last.start.getDate()).toBe(1);
    expect(last.end.getMonth()).toBe(6); // exclusive: July 1
    expect(last.end.getDate()).toBe(1);
  });

  it("crosses the year boundary correctly", () => {
    const buckets = monthlyBuckets(new Date(2026, 1, 15), 6); // Feb 2026
    expect(buckets.map((b) => b.label)).toEqual(["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"]);
    expect(buckets[0].start.getFullYear()).toBe(2025);
    expect(buckets[5].start.getFullYear()).toBe(2026);
  });
});

describe("computeDashboardMetrics — headline numbers", () => {
  it("win rate is signed over everything that reached a client and resolved", () => {
    const m = computeDashboardMetrics(
      [
        mk({ status: "SIGNED" }),
        mk({ status: "SIGNED" }),
        mk({ status: "DECLINED" }),
        mk({ status: "SENT", sentAt: new Date(2026, 5, 14) }),
        mk({ status: "DRAFT" }), // never sent → excluded from the denominator
      ],
      NOW
    );
    expect(m.signedCount).toBe(2);
    expect(m.decidedCount).toBe(4);
    expect(m.winRate).toBe(50);
  });

  it("win rate is 0 when nothing has been decided", () => {
    expect(computeDashboardMetrics([mk({ status: "DRAFT" })], NOW).winRate).toBe(0);
  });

  it("contracted one-time and MRR sum only signed deals", () => {
    const m = computeDashboardMetrics(
      [
        mk({ status: "SIGNED", oneTimeCents: 2_400_000, recurringMonthlyCents: 120_000 }),
        mk({ status: "SIGNED", oneTimeCents: 3_850_000, recurringMonthlyCents: 0 }),
        mk({ status: "SENT", oneTimeCents: 9_900_000, recurringMonthlyCents: 99_900, sentAt: NOW }),
      ],
      NOW
    );
    expect(m.contractedCents).toBe(6_250_000);
    expect(m.mrrCents).toBe(120_000);
  });
});

describe("computeDashboardMetrics — month-over-month", () => {
  it("counts signings in this vs last calendar month", () => {
    const m = computeDashboardMetrics(
      [
        mk({ status: "SIGNED", completedAt: new Date(2026, 5, 3) }), // June
        mk({ status: "SIGNED", completedAt: new Date(2026, 5, 12) }), // June
        mk({ status: "SIGNED", completedAt: new Date(2026, 4, 20) }), // May
      ],
      NOW
    );
    expect(m.signedThisMonth).toBe(2);
    expect(m.signedLastMonth).toBe(1);
  });

  it("MRR delta is the recurring revenue added this month", () => {
    const m = computeDashboardMetrics(
      [
        mk({ status: "SIGNED", recurringMonthlyCents: 100_000, completedAt: new Date(2026, 2, 10) }), // Mar
        mk({ status: "SIGNED", recurringMonthlyCents: 50_000, completedAt: new Date(2026, 5, 5) }), // Jun
      ],
      NOW
    );
    expect(m.mrrDeltaCents).toBe(50_000);
  });

  it("average time to sign is the mean sent→signed duration, ignoring deals never sent", () => {
    const m = computeDashboardMetrics(
      [
        mk({ status: "SIGNED", sentAt: new Date(2026, 5, 1), completedAt: new Date(2026, 5, 2) }), // 24h
        mk({ status: "SIGNED", sentAt: new Date(2026, 5, 1), completedAt: new Date(2026, 5, 3) }), // 48h
        mk({ status: "SIGNED", sentAt: null, completedAt: new Date(2026, 5, 4) }), // excluded
      ],
      NOW
    );
    expect(m.avgSignMs).toBe(36 * 60 * 60 * 1000);
  });

  it("oldest open is the longest-waiting live proposal, in ms since it was sent", () => {
    const m = computeDashboardMetrics(
      [
        mk({ status: "SENT", sentAt: new Date(NOW.getTime() - 16 * DAY) }),
        mk({ status: "VIEWED", sentAt: new Date(NOW.getTime() - 3 * DAY) }),
        mk({ status: "SIGNED", sentAt: new Date(NOW.getTime() - 99 * DAY) }), // closed → ignored
      ],
      NOW
    );
    expect(m.oldestOpenMs).toBe(16 * DAY);
  });

  it("oldest open is null when nothing is waiting", () => {
    expect(computeDashboardMetrics([mk({ status: "SIGNED" })], NOW).oldestOpenMs).toBeNull();
  });
});

describe("computeDashboardMetrics — sparkline series", () => {
  const proposals = [
    mk({ status: "SIGNED", recurringMonthlyCents: 100_000, completedAt: new Date(2026, 2, 10) }), // Mar
    mk({ status: "SIGNED", recurringMonthlyCents: 50_000, completedAt: new Date(2026, 5, 5) }), // Jun
  ];

  it("MRR series is the cumulative recurring stock at each month end", () => {
    const m = computeDashboardMetrics(proposals, NOW);
    expect(m.mrrSeries).toEqual([0, 0, 100_000, 100_000, 100_000, 150_000]);
  });

  it("signed series counts signings within each month", () => {
    const m = computeDashboardMetrics(proposals, NOW);
    expect(m.signedSeries).toEqual([0, 0, 1, 0, 0, 1]);
  });

  it("avg-sign series is null for months with no signings", () => {
    const m = computeDashboardMetrics(
      [
        mk({ status: "SIGNED", sentAt: new Date(2026, 2, 9), completedAt: new Date(2026, 2, 10) }), // Mar, 24h
        mk({ status: "SIGNED", sentAt: new Date(2026, 5, 3), completedAt: new Date(2026, 5, 5) }), // Jun, 48h
      ],
      NOW
    );
    expect(m.avgSignSeries).toEqual([null, null, 24 * DAY / 24, null, null, 48 * DAY / 24]);
  });
});

describe("hasSparklineSignal", () => {
  it("needs at least two non-zero data points", () => {
    expect(hasSparklineSignal([0, 0, 1, 0, 0, 1])).toBe(true);
    expect(hasSparklineSignal([0, 0, 0, 0, 0, 5])).toBe(false);
    expect(hasSparklineSignal([0, 0, 0, 0, 0, 0])).toBe(false);
  });

  it("treats null (no data) as no signal", () => {
    expect(hasSparklineSignal([null, null, 3, null, null, null])).toBe(false);
    expect(hasSparklineSignal([null, 3, null, 4, null, null])).toBe(true);
  });
});

describe("computeDashboardMetrics — attention detection", () => {
  it("flags signed deals awaiting (or failed) payment", () => {
    const m = computeDashboardMetrics(
      [
        mk({ id: "await", status: "SIGNED", paymentStatus: "AWAITING", company: "Lumen Health" }),
        mk({ id: "failed", status: "SIGNED", paymentStatus: "FAILED" }),
        mk({ id: "paid", status: "SIGNED", paymentStatus: "PAID" }), // not flagged
        mk({ id: "proc", status: "SIGNED", paymentStatus: "PROCESSING" }), // ACH in flight, not flagged
      ],
      NOW
    );
    const ids = m.attention.map((a) => a.id);
    expect(ids).toContain("await");
    expect(ids).toContain("failed");
    expect(ids).not.toContain("paid");
    expect(ids).not.toContain("proc");
    expect(m.attention.find((a) => a.id === "await")?.reason).toBe("awaiting_payment");
  });

  it("flags open proposals older than the attention threshold", () => {
    const m = computeDashboardMetrics(
      [
        mk({ id: "stale", status: "SENT", sentAt: new Date(NOW.getTime() - 16 * DAY), company: "Atlas Goods" }),
        mk({ id: "fresh", status: "SENT", sentAt: new Date(NOW.getTime() - 3 * DAY) }),
      ],
      NOW
    );
    const stale = m.attention.find((a) => a.id === "stale");
    expect(stale?.reason).toBe("stale_open");
    expect(stale?.ageDays).toBe(16);
    expect(m.attention.find((a) => a.id === "fresh")).toBeUndefined();
  });
});

describe("filters", () => {
  const rows = [
    { status: "SENT" as const, needsAttention: true },
    { status: "SIGNED" as const, needsAttention: false },
    { status: "SIGNED" as const, needsAttention: true },
    { status: "DECLINED" as const, needsAttention: false },
  ];

  it("counts each filter bucket", () => {
    expect(filterCounts(rows)).toEqual({ all: 4, open: 1, signed: 2, attention: 2 });
  });

  it("matches rows to the active filter", () => {
    expect(rowMatchesFilter(rows[0], "open")).toBe(true);
    expect(rowMatchesFilter(rows[0], "signed")).toBe(false);
    expect(rowMatchesFilter(rows[2], "attention")).toBe(true);
    expect(rowMatchesFilter(rows[3], "all")).toBe(true);
  });
});
