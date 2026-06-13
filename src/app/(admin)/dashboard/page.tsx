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
import { Banknote, FileSignature, Hourglass, PenLine, Plus } from "lucide-react";
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

/** Compact stat: 3-up strip on mobile (icon hidden), roomy card on desktop. */
function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tint: string;
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
        <p className="font-heading mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
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

export default async function DashboardPage() {
  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    include: { parties: true, payment: true },
  });

  const open = proposals.filter((p) =>
    ["SENT", "VIEWED", "PARTIALLY_SIGNED"].includes(p.status)
  ).length;
  const signedAwaiting = proposals.filter(
    (p) => p.status === "SIGNED" && p.paymentStatus !== "PAID" && p.paymentStatus !== "NOT_REQUIRED"
  ).length;
  const paidCents = proposals
    .filter((p) => p.payment?.amountTotalCents)
    .reduce((sum, p) => sum + (p.payment?.amountTotalCents ?? 0), 0);

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
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold">Proposals</h1>
          <p className="text-sm text-muted-foreground">
            Send, e-sign, and collect payment in one flow.
          </p>
        </div>
        <Button size="sm" nativeButton={false} render={<Link href="/proposals/new" />}>
          <Plus className="h-4 w-4" />
          <span className="max-sm:sr-only">New proposal</span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          label="Awaiting signature"
          value={String(open)}
          tint="bg-accent text-primary"
          icon={<Hourglass className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Signed, unpaid"
          value={String(signedAwaiting)}
          tint="bg-amber-50 text-amber-600"
          icon={<PenLine className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Collected via checkout"
          value={formatCents(paidCents)}
          tint="bg-emerald-50 text-emerald-600"
          icon={<Banknote className="h-3.5 w-3.5" />}
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
