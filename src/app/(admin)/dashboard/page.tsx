import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/currency";
import { effectiveLineItems, type PaymentConfig, type TokensJson } from "@/lib/types";
import {
  ATTENTION_AGE_DAYS,
  computeDashboardMetrics,
  hasSparklineSignal,
  OPEN_STATUSES,
  type NormalizedProposal,
} from "@/lib/dashboardMetrics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AvgTimeCard,
  HeroMetric,
  OldestOpenCard,
  SignedThisMonthCard,
  WinRateCard,
} from "@/components/dashboard/metrics";
import { ProposalsPanel, type PanelRow } from "@/components/dashboard/proposalsPanel";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/** Sent-to-signed / age durations, rounded to the most readable unit. */
function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export default async function DashboardPage() {
  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    include: { parties: true, payment: true },
  });
  const now = new Date();

  // One pass: derive the effective amounts (same math as the contracted/MRR rollups) plus the
  // serialized table row. The pure metrics module then operates on the normalized shape.
  const enriched = proposals.map((proposal) => {
    const tokens = proposal.tokens as unknown as TokensJson;
    const config = proposal.paymentConfig as unknown as PaymentConfig;
    const { oneTime, recurring } = effectiveLineItems(config, proposal.selectedTierId);
    const selectedAddOnIds = (proposal.selectedAddOnIds as unknown as string[] | null) ?? [];
    const addOns = (config.addOns ?? []).filter((a) => selectedAddOnIds.includes(a.id));

    const oneTimeCents =
      (oneTime?.amountCents ?? 0) +
      addOns.filter((a) => a.intervalMonths === null).reduce((s, a) => s + a.amountCents, 0);
    const recurringMonthlyCents =
      (recurring && recurring.intervalMonths === 1 ? recurring.amountCents : 0) +
      addOns.filter((a) => a.intervalMonths === 1).reduce((s, a) => s + a.amountCents, 0);

    const dealParts: string[] = [];
    if (config.tiers && !proposal.selectedTierId) {
      dealParts.push(`${config.tiers.length} options`);
    } else {
      if (oneTime) dealParts.push(formatCents(oneTime.amountCents));
      if (recurring) dealParts.push(`${formatCents(recurring.amountCents)}/mo`);
    }
    const company = tokens["Client.Company"];

    const normalized: NormalizedProposal = {
      id: proposal.id,
      status: proposal.status,
      paymentStatus: proposal.paymentStatus,
      sentAt: proposal.sentAt,
      completedAt: proposal.completedAt,
      oneTimeCents,
      recurringMonthlyCents,
      company,
      title: proposal.title,
    };

    return {
      proposal,
      normalized,
      clientLine: `${tokens["Client.FirstName"]} ${tokens["Client.LastName"]} · ${company}`,
      deal: dealParts.join(" + ") || "Sign-only",
    };
  });

  const metrics = computeDashboardMetrics(
    enriched.map((e) => e.normalized),
    now
  );
  const attentionIds = new Set(metrics.attention.map((a) => a.id));

  const rows: PanelRow[] = enriched.map((e) => ({
    id: e.proposal.id,
    title: e.proposal.title,
    version: e.proposal.versionNumber,
    clientLine: e.clientLine,
    deal: e.deal,
    status: e.proposal.status,
    paymentStatus: e.proposal.paymentStatus,
    validUntil: e.proposal.validUntil
      ? e.proposal.validUntil.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null,
    needsAttention: attentionIds.has(e.proposal.id),
  }));

  // --- Display derivations (presentation only) ---
  const mrrDeltaLabel =
    metrics.mrrDeltaCents > 0 ? `${formatCents(metrics.mrrDeltaCents)} vs last month` : null;

  const signedDelta = metrics.signedThisMonth - metrics.signedLastMonth;
  const signedDeltaLabel = signedDelta !== 0 ? `${signedDelta > 0 ? "+" : ""}${signedDelta}` : null;

  const avgPts = metrics.avgSignSeries.filter((v): v is number => v != null);
  const avgTrend =
    avgPts.length >= 2
      ? avgPts[avgPts.length - 1] < avgPts[avgPts.length - 2]
        ? ("faster" as const)
        : avgPts[avgPts.length - 1] > avgPts[avgPts.length - 2]
          ? ("slower" as const)
          : null
      : null;

  const oldestOpen = enriched
    .filter((e) => OPEN_STATUSES.includes(e.proposal.status) && e.proposal.sentAt)
    .reduce<(typeof enriched)[number] | null>(
      (oldest, e) =>
        !oldest || e.proposal.sentAt! < oldest.proposal.sentAt! ? e : oldest,
      null
    );
  const oldestOpenWarn =
    metrics.oldestOpenMs != null && metrics.oldestOpenMs > ATTENTION_AGE_DAYS * DAY_MS;
  const oldestOpenSub =
    metrics.oldestOpenMs == null
      ? "nothing waiting"
      : `${oldestOpen?.normalized.company ?? "—"} · ${oldestOpenWarn ? "needs a nudge" : "waiting"}`;

  const awaiting = metrics.attention.filter((a) => a.reason === "awaiting_payment");
  const stale = metrics.attention.filter((a) => a.reason === "stale_open");
  const summaryParts: string[] = [];
  if (awaiting.length) {
    summaryParts.push(
      awaiting.length === 1
        ? `1 awaiting payment (${awaiting[0].company})`
        : `${awaiting.length} awaiting payment`
    );
  }
  if (stale.length) {
    const oldest = stale.reduce((a, b) => ((a.ageDays ?? 0) >= (b.ageDays ?? 0) ? a : b));
    summaryParts.push(
      stale.length === 1
        ? `1 open ${oldest.ageDays} days (${oldest.company})`
        : `${stale.length} open (oldest ${oldest.ageDays}d)`
    );
  }
  const attentionSummary = summaryParts.join(", ");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Proposals</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Live pipeline across all clients</p>
        </div>
        <Button size="sm" nativeButton={false} render={<Link href="/proposals/new" />}>
          <Plus className="h-4 w-4" />
          <span className="max-sm:sr-only">New proposal</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
        <HeroMetric
          valueLabel={formatCents(metrics.mrrCents)}
          deltaLabel={mrrDeltaLabel}
          contractedLabel={formatCents(metrics.contractedCents)}
          series={metrics.mrrSeries}
          showSparkline={hasSparklineSignal(metrics.mrrSeries)}
        />
        <WinRateCard
          pct={metrics.winRate}
          sub={`${metrics.signedCount} signed of ${metrics.decidedCount} sent`}
        />
        <SignedThisMonthCard
          value={metrics.signedThisMonth}
          deltaLabel={signedDeltaLabel}
          deltaTone={signedDelta >= 0 ? "up" : "down"}
          series={metrics.signedSeries}
          showSparkline={hasSparklineSignal(metrics.signedSeries)}
          sub={`vs ${metrics.signedLastMonth} last month`}
        />
        <AvgTimeCard
          valueLabel={metrics.avgSignMs != null ? formatDuration(metrics.avgSignMs) : "-"}
          trend={avgTrend}
          series={metrics.avgSignSeries}
          showSparkline={hasSparklineSignal(metrics.avgSignSeries)}
          sub="sent to signed"
        />
        <OldestOpenCard
          valueLabel={metrics.oldestOpenMs != null ? formatDuration(metrics.oldestOpenMs) : "-"}
          sub={oldestOpenSub}
          warn={oldestOpenWarn}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileSignature className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium">No proposals yet</p>
              <p className="text-sm text-muted-foreground">
                Import a tokens JSON from the generate-proposal skill or start from scratch.
              </p>
            </div>
            <Button size="sm" nativeButton={false} render={<Link href="/proposals/new" />}>
              <Plus className="h-4 w-4" />
              New Proposal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ProposalsPanel
          rows={rows}
          attentionCount={metrics.attention.length}
          attentionSummary={attentionSummary}
        />
      )}
    </div>
  );
}
