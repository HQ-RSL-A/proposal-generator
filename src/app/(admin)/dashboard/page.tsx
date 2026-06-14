import type { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/currency";
import { effectiveLineItems, type PaymentConfig, type TokensJson } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentChip, StatusChip } from "@/components/dashboard/statusChip";
import { Button } from "@/components/ui/button";
import {
  AlarmClock,
  Banknote,
  Clock,
  FileSignature,
  PenLine,
  Plus,
  Repeat,
  Trophy,
} from "lucide-react";
import type { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

interface ProposalRow {
  id: string;
  title: string;
  version: number;
  client: string;
  company: string;
  deal: string;
  status: ProposalStatus;
  paymentStatus: PaymentStatus;
  validUntil: string | null;
}

/** Compact stat: 2-up on mobile, 3-up on desktop. Icon hidden on mobile to save room. */
function StatCard({
  label,
  value,
  sub,
  icon,
  tint,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  tint: string;
  tone?: "default" | "warn";
}) {
  return (
    <Card className="card-hover">
      <CardContent className="pt-3 sm:pt-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-tag text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
            {label}
          </p>
          <span
            className={cn(
              "hidden h-7 w-7 shrink-0 items-center justify-center rounded-md sm:flex",
              tint
            )}
          >
            {icon}
          </span>
        </div>
        <p
          className={cn(
            "font-heading mt-1 text-xl font-bold tabular-nums sm:text-2xl",
            tone === "warn" && "text-amber-600"
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

/** Tappable proposal card for mobile, replacing the wide table below md. */
function MobileProposalCard({ row }: { row: ProposalRow }) {
  return (
    <Link
      href={`/proposals/${row.id}`}
      className="block rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10 transition-transform duration-150 ease-out hover:ring-foreground/20 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.title}
            {row.version > 1 ? (
              <span className="ml-1.5 text-xs text-muted-foreground">v{row.version}</span>
            ) : null}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {row.client} · {row.company}
          </p>
        </div>
        {row.validUntil ? (
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {row.validUntil}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <StatusChip status={row.status} />
          <PaymentChip paymentStatus={row.paymentStatus} status={row.status} />
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums">{row.deal}</span>
      </div>
    </Link>
  );
}

/** Sent-to-signed / age durations, rounded to the most readable unit. */
function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const OPEN_STATUSES: ProposalStatus[] = ["SENT", "VIEWED", "PARTIALLY_SIGNED"];

export default async function DashboardPage() {
  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    include: { parties: true, payment: true },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Win rate: signed out of everything that reached a client and resolved or is live.
  const decided = proposals.filter((p) =>
    ["SENT", "VIEWED", "PARTIALLY_SIGNED", "SIGNED", "DECLINED", "EXPIRED"].includes(p.status)
  );
  const signedAll = proposals.filter((p) => p.status === "SIGNED");
  const winRate = decided.length > 0 ? Math.round((signedAll.length / decided.length) * 100) : 0;

  // Contracted one-time + MRR, both from signed deals (incl. their selected add-ons).
  let contractedCents = 0;
  let mrrCents = 0;
  for (const p of signedAll) {
    const config = p.paymentConfig as unknown as PaymentConfig;
    const { oneTime, recurring } = effectiveLineItems(config, p.selectedTierId);
    const selectedAddOnIds = (p.selectedAddOnIds as unknown as string[] | null) ?? [];
    const addOns = (config.addOns ?? []).filter((a) => selectedAddOnIds.includes(a.id));
    contractedCents +=
      (oneTime?.amountCents ?? 0) +
      addOns.filter((a) => a.intervalMonths === null).reduce((s, a) => s + a.amountCents, 0);
    if (recurring && recurring.intervalMonths === 1) mrrCents += recurring.amountCents;
    mrrCents += addOns.filter((a) => a.intervalMonths === 1).reduce((s, a) => s + a.amountCents, 0);
  }

  const signedThisMonth = signedAll.filter(
    (p) => p.completedAt && p.completedAt >= monthStart
  ).length;
  const signedLastMonth = signedAll.filter(
    (p) => p.completedAt && p.completedAt >= lastMonthStart && p.completedAt < monthStart
  ).length;

  const signTimes = signedAll
    .filter((p) => p.completedAt && p.sentAt)
    .map((p) => p.completedAt!.getTime() - p.sentAt!.getTime());
  const avgSignMs = signTimes.length
    ? signTimes.reduce((a, b) => a + b, 0) / signTimes.length
    : null;

  const openWithSent = proposals.filter((p) => OPEN_STATUSES.includes(p.status) && p.sentAt);
  const oldestOpenMs = openWithSent.length
    ? Math.max(...openWithSent.map((p) => now.getTime() - p.sentAt!.getTime()))
    : null;

  const rows: ProposalRow[] = proposals.map((proposal) => {
    const tokens = proposal.tokens as unknown as TokensJson;
    const config = proposal.paymentConfig as unknown as PaymentConfig;
    const { oneTime, recurring } = effectiveLineItems(config, proposal.selectedTierId);
    const dealParts: string[] = [];
    if (config.tiers && !proposal.selectedTierId) {
      dealParts.push(`${config.tiers.length} options`);
    } else {
      if (oneTime) dealParts.push(formatCents(oneTime.amountCents));
      if (recurring) dealParts.push(`${formatCents(recurring.amountCents)}/mo`);
    }
    return {
      id: proposal.id,
      title: proposal.title,
      version: proposal.versionNumber,
      client: `${tokens["Client.FirstName"]} ${tokens["Client.LastName"]}`,
      company: tokens["Client.Company"],
      deal: dealParts.join(" + ") || "Sign-only",
      status: proposal.status,
      paymentStatus: proposal.paymentStatus,
      validUntil: proposal.validUntil
        ? proposal.validUntil.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Proposals</h1>
        <Button size="sm" nativeButton={false} render={<Link href="/proposals/new" />}>
          <Plus className="h-4 w-4" />
          <span className="max-sm:sr-only">New proposal</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label="Win rate"
          value={`${winRate}%`}
          sub={`${signedAll.length} signed of ${decided.length} sent`}
          tint="bg-accent text-primary"
          icon={<Trophy className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Contracted one-time"
          value={formatCents(contractedCents)}
          sub="build fees on signed deals"
          tint="bg-emerald-50 text-emerald-600"
          icon={<Banknote className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="MRR"
          value={formatCents(mrrCents)}
          sub="from signed recurring deals"
          tint="bg-accent text-primary"
          icon={<Repeat className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Signed this month"
          value={String(signedThisMonth)}
          sub={`vs ${signedLastMonth} last month`}
          tint="bg-amber-50 text-amber-600"
          icon={<PenLine className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Avg time to sign"
          value={avgSignMs != null ? formatDuration(avgSignMs) : "-"}
          sub="sent to signed"
          tint="bg-accent text-primary"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Oldest open"
          value={oldestOpenMs != null ? formatDuration(oldestOpenMs) : "-"}
          sub={oldestOpenMs != null ? "since it was sent" : "nothing waiting"}
          tint="bg-amber-50 text-amber-600"
          icon={<AlarmClock className="h-3.5 w-3.5" />}
          tone={oldestOpenMs != null && oldestOpenMs > 14 * 86_400_000 ? "warn" : "default"}
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
        <>
          <p className="text-xs text-muted-foreground">
            {rows.length} proposal{rows.length === 1 ? "" : "s"}
          </p>

          {/* Desktop: full table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valid until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="group relative cursor-pointer transition-colors hover:bg-surface"
                  >
                    <TableCell>
                      {/* The stretched link makes the whole row a click target. */}
                      <Link
                        href={`/proposals/${row.id}`}
                        className="font-medium group-hover:text-primary after:absolute after:inset-0 after:content-['']"
                      >
                        {row.title}
                      </Link>
                      {row.version > 1 ? (
                        <span className="ml-2 text-xs text-muted-foreground">v{row.version}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.client} · {row.company}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{row.deal}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusChip status={row.status} />
                        <PaymentChip paymentStatus={row.paymentStatus} status={row.status} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {row.validUntil ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: tappable card list */}
          <div className="space-y-2.5 md:hidden">
            {rows.map((row) => (
              <MobileProposalCard key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
