"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        <Tabs value={filter} onValueChange={(value) => setFilter(value as ProposalFilter)}>
          <TabsList className="gap-1 rounded-xl bg-border-subtle p-1 group-data-horizontal/tabs:h-auto">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="group/trigger h-auto flex-none rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-150 ease-out-strong hover:text-foreground data-active:bg-card data-active:font-semibold data-active:text-foreground data-active:shadow-sm"
              >
                {t.label}
                <Badge
                  variant="secondary"
                  className="h-4.5 min-w-4.5 border-0 bg-foreground/5 px-1 text-xs tabular-nums text-muted-foreground group-data-active/trigger:bg-accent group-data-active/trigger:text-primary"
                >
                  {counts[t.key]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          {visible.length} proposal{visible.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Keyed by filter: the swap gets a 150ms fade instead of a hard cut. */}
      <div
        key={filter}
        className="space-y-4 animate-in fade-in-0 duration-150 ease-out-strong motion-reduce:animate-none"
      >
      {visible.length === 0 ? (
        <Card size="lg" className="py-12 text-center text-muted-foreground">
          Nothing in this filter right now.
        </Card>
      ) : (
        <>
          {/* Desktop: full table */}
          <Card size="lg" className="hidden py-0 md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="border-border-subtle bg-surface-raised hover:bg-surface-raised">
                  <TableHead className="h-auto w-[28%] py-3 pr-2 pl-(--card-spacing)">
                    <CardLabel>Proposal</CardLabel>
                  </TableHead>
                  <TableHead className="h-auto w-[24%] px-2 py-3">
                    <CardLabel>Client</CardLabel>
                  </TableHead>
                  <TableHead className="h-auto w-[18%] px-2 py-3">
                    <CardLabel>Deal</CardLabel>
                  </TableHead>
                  <TableHead className="h-auto w-[19%] px-2 py-3">
                    <CardLabel>Status</CardLabel>
                  </TableHead>
                  <TableHead className="h-auto w-[11%] py-3 pr-(--card-spacing) pl-2 text-right">
                    <CardLabel>Valid until</CardLabel>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow
                    key={row.id}
                    className="group relative cursor-pointer border-border-subtle hover:bg-surface"
                  >
                    <TableCell className="py-3.5 pr-2 pl-(--card-spacing) whitespace-normal">
                      <Link
                        href={`/proposals/${row.id}`}
                        className="font-medium after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
                      >
                        {row.title}
                      </Link>
                      {row.version > 1 ? (
                        <span className="ml-2 text-xs text-muted-foreground">v{row.version}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="truncate px-2 py-3.5 text-muted-foreground">
                      {row.clientLine}
                    </TableCell>
                    <TableCell className="px-2 py-3.5 tabular-nums text-foreground/80">
                      {row.deal}
                    </TableCell>
                    <TableCell className="px-2 py-3.5 whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        <StatusChip status={row.status} />
                        <PaymentChip paymentStatus={row.paymentStatus} status={row.status} />
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 pr-(--card-spacing) pl-2 text-right text-muted-foreground">
                      {row.validUntil ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </div>
  );
}
