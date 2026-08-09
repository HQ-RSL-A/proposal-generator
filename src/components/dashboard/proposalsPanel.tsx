"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardLabel } from "@/components/ui/card";
import { PaymentChip, StatusChip } from "@/components/dashboard/statusChip";
import {
  filterCounts,
  rowMatchesFilter,
  type ProposalFilter,
} from "@/lib/dashboardMetrics";
import type { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";

/** A table row, fully serialized server-side so this island stays a thin client component. */
export interface PanelRow {
  id: string;
  title: string;
  version: number;
  clientLine: string;
  deal: string;
  status: ProposalStatus;
  paymentStatus: PaymentStatus;
  validUntil: string | null;
  needsAttention: boolean;
}

const TABS: { key: ProposalFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "signed", label: "Signed" },
  { key: "attention", label: "Needs attention" },
];

const COLS = "grid-cols-[2.4fr_2fr_1.5fr_1.6fr_0.9fr]";

export function ProposalsPanel({
  rows,
  attentionCount,
  attentionSummary,
}: {
  rows: PanelRow[];
  attentionCount: number;
  attentionSummary: string;
}) {
  const [filter, setFilter] = useState<ProposalFilter>("all");
  const counts = filterCounts(rows);
  const visible = rows.filter((r) => rowMatchesFilter(r, filter));

  return (
    <div className="space-y-4">
      {attentionCount > 0 ? (
        <Card tone="warning" className="flex-row items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-warning ring-4 ring-warning/20" />
            <p className="text-warning-subtle-foreground">
              <strong className="font-semibold">
                {attentionCount} proposal{attentionCount === 1 ? "" : "s"}{" "}
                need{attentionCount === 1 ? "s" : ""} attention
              </strong>
              {attentionSummary ? ` — ${attentionSummary}` : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilter("attention")}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-warning-subtle-foreground underline-offset-4 hover:underline"
          >
            Review <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-border-subtle p-1">
          {TABS.map((t) => {
            const active = t.key === filter;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-[color,background-color,box-shadow] duration-150 ease-out-strong",
                  active
                    ? "bg-card font-semibold text-foreground shadow-sm"
                    : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    active ? "text-primary" : "text-muted-foreground/70"
                  )}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {visible.length} proposal{visible.length === 1 ? "" : "s"}
        </p>
      </div>

      {visible.length === 0 ? (
        <Card size="lg" className="py-12 text-center text-muted-foreground">
          Nothing in this filter right now.
        </Card>
      ) : (
        <>
          {/* Desktop: full table */}
          <Card size="lg" className="hidden py-0 md:block">
            <div
              className={cn(
                "grid gap-3 border-b border-border-subtle bg-surface-raised px-(--card-spacing) py-3",
                COLS
              )}
            >
              {["Proposal", "Client", "Deal", "Status"].map((h) => (
                <CardLabel key={h}>{h}</CardLabel>
              ))}
              <CardLabel className="text-right">Valid until</CardLabel>
            </div>

            {visible.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "group relative grid cursor-pointer items-center gap-3 border-b border-border-subtle px-(--card-spacing) py-3.5 transition-colors last:border-0 hover:bg-surface",
                  COLS
                )}
              >
                <div className="min-w-0">
                  <Link
                    href={`/proposals/${row.id}`}
                    className="font-medium after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
                  >
                    {row.title}
                  </Link>
                  {row.version > 1 ? (
                    <span className="ml-2 text-xs text-muted-foreground">v{row.version}</span>
                  ) : null}
                </div>
                <div className="truncate text-sm text-muted-foreground">{row.clientLine}</div>
                <div className="text-sm tabular-nums text-foreground/80">{row.deal}</div>
                <div className="flex flex-wrap gap-1">
                  <StatusChip status={row.status} />
                  <PaymentChip paymentStatus={row.paymentStatus} status={row.status} />
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {row.validUntil ?? "-"}
                </div>
              </div>
            ))}
          </Card>

          {/* Mobile: tappable cards */}
          <div className="space-y-3 md:hidden">
            {visible.map((row) => (
              <Link
                key={row.id}
                href={`/proposals/${row.id}`}
                className="block rounded-xl transition-transform duration-150 ease-out-strong active:scale-[0.98]"
              >
                <Card className="gap-3 px-4 transition-shadow duration-150 ease-out-strong hover:ring-foreground/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {row.title}
                        {row.version > 1 ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">v{row.version}</span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{row.clientLine}</p>
                    </div>
                    {row.validUntil ? (
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {row.validUntil}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1">
                      <StatusChip status={row.status} />
                      <PaymentChip paymentStatus={row.paymentStatus} status={row.status} />
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">{row.deal}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
