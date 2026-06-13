import Link from "next/link";
import { prisma } from "@/lib/prisma";
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

export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Proposals</h1>
          <p className="text-sm text-muted-foreground">
            Send, e-sign, and collect payment in one flow.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="card-hover">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <p className="font-tag text-xs uppercase tracking-wide text-muted-foreground">
                Awaiting signature
              </p>
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-primary">
                <Hourglass className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="font-heading mt-1 text-2xl font-bold tabular-nums">{open}</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <p className="font-tag text-xs uppercase tracking-wide text-muted-foreground">
                Signed, unpaid
              </p>
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                <PenLine className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="font-heading mt-1 text-2xl font-bold tabular-nums">{signedAwaiting}</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <p className="font-tag text-xs uppercase tracking-wide text-muted-foreground">
                Collected via checkout
              </p>
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <Banknote className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="font-heading mt-1 text-2xl font-bold tabular-nums">
              {formatCents(paidCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      {proposals.length === 0 ? (
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
        <Card>
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
              {proposals.map((proposal) => {
                const tokens = proposal.tokens as unknown as TokensJson;
                const config = proposal.paymentConfig as unknown as PaymentConfig;
                const { oneTime, recurring } = effectiveLineItems(
                  config,
                  proposal.selectedTierId
                );
                const dealParts: string[] = [];
                if (config.tiers && !proposal.selectedTierId) {
                  dealParts.push(`${config.tiers.length} options`);
                } else {
                  if (oneTime) dealParts.push(formatCents(oneTime.amountCents));
                  if (recurring) dealParts.push(`${formatCents(recurring.amountCents)}/mo`);
                }
                return (
                  <TableRow
                    key={proposal.id}
                    className="group relative cursor-pointer transition-colors hover:bg-surface"
                  >
                    <TableCell>
                      {/* The stretched link makes the whole row a click target. */}
                      <Link
                        href={`/proposals/${proposal.id}`}
                        className="font-medium group-hover:text-primary after:absolute after:inset-0 after:content-['']"
                      >
                        {proposal.title}
                      </Link>
                      {proposal.versionNumber > 1 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          v{proposal.versionNumber}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tokens["Client.FirstName"]} {tokens["Client.LastName"]} ·{" "}
                      {tokens["Client.Company"]}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {dealParts.join(" + ") || "Sign-only"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusChip status={proposal.status} />
                        <PaymentChip
                          paymentStatus={proposal.paymentStatus}
                          status={proposal.status}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {proposal.validUntil
                        ? proposal.validUntil.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
