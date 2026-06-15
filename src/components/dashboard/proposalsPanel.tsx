"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="space-y-3.5">
      {attentionCount > 0 ? (
        <div className="flex items-center justify-between gap-4 rounded-[14px] bg-amber-50 px-4.5 py-3.5 ring-1 ring-amber-500/20">
          <div className="flex items-center gap-3">
            <span className="h-2.25 w-2.25 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]" />
            <p className="text-[13.5px] text-amber-800">
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
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-amber-700 transition-colors hover:text-amber-800"
          >
            Review <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.75 rounded-[11px] bg-[#EEF1F6] p-1">
          {TABS.map((t) => {
            const active = t.key === filter;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.75 text-[13px] transition-[color,background-color,box-shadow] duration-150 ease-out",
                  active
                    ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(17,24,39,0.10)]"
                    : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
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
        <div className="rounded-2xl bg-card py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/[0.07]">
          Nothing in this filter right now.
        </div>
      ) : (
        <>
          {/* Desktop: full table */}
          <div className="hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.07] md:block">
            <div
              className={cn(
                "grid gap-3 border-b border-[#EEF1F6] bg-[#FCFCFD] px-5.5 py-3.25",
                COLS
              )}
            >
              {["Proposal", "Client", "Deal", "Status"].map((h) => (
                <span
                  key={h}
                  className="font-tag text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/80"
                >
                  {h}
                </span>
              ))}
              <span className="font-tag text-right text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/80">
                Valid until
              </span>
            </div>

            {visible.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "group relative grid cursor-pointer items-center gap-3 border-b border-[#F4F6F9] px-5.5 py-3.75 transition-colors last:border-0 hover:bg-surface",
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
          </div>

          {/* Mobile: tappable cards */}
          <div className="space-y-2.5 md:hidden">
            {visible.map((row) => (
              <Link
                key={row.id}
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
                    <p className="truncate text-sm text-muted-foreground">{row.clientLine}</p>
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
