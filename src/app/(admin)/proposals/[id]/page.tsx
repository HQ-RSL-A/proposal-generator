import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authGuard";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/dates";
import { buildProposalSections, sectionsFromFrozen } from "@/lib/proposalContent";
import { frozenPaymentConfig, frozenTokens } from "@/lib/signingService";
import type { FrozenContent } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentChip, StatusChip } from "@/components/dashboard/statusChip";
import { ProposalActions } from "@/components/proposals/proposalActions";
import { PartyList, type PartyRow } from "@/components/proposals/partyList";
import { AuditTimeline } from "@/components/proposals/auditTimeline";
import { ProposalView } from "@/components/proposal/proposalView";
import { retryJob } from "@/actions/proposals";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUser();
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      parties: { orderBy: { orderIndex: "asc" } },
      signatures: true,
      auditEvents: { orderBy: { occurredAt: "desc" }, take: 200 },
      emailLogs: { orderBy: { sentAt: "desc" } },
      documents: { orderBy: { generatedAt: "desc" } },
      jobs: { where: { status: { in: ["DEAD", "PENDING", "PROCESSING"] } } },
      msaVersion: true,
      payment: true,
      parent: { select: { id: true, versionNumber: true } },
      revisions: { select: { id: true, versionNumber: true } },
    },
  });
  if (!proposal) notFound();

  const tokens = frozenTokens(proposal);
  const config = frozenPaymentConfig(proposal);
  const frozen = proposal.frozenContent as unknown as FrozenContent | null;
  const sections = frozen
    ? sectionsFromFrozen(frozen, proposal.msaVersion.bodyMarkdown, proposal.selectedTierId)
    : buildProposalSections({
        tokens,
        paymentConfig: config,
        msaBodyMarkdown: proposal.msaVersion.bodyMarkdown,
        selectedTierId: proposal.selectedTierId,
      });
  const selectedAddOnIds = (proposal.selectedAddOnIds as unknown as string[] | null) ?? [];

  const partyRows: PartyRow[] = proposal.parties.map((party) => {
    const lastEmail = proposal.emailLogs.find((log) => log.partyId === party.id);
    return {
      id: party.id,
      role: party.role,
      name: party.name,
      email: party.email,
      payer: party.payer,
      signedAtLabel: party.signedAt ? formatDate(party.signedAt) : null,
      declined: Boolean(party.declinedAt),
      emailBounced: party.emailBounced,
      lastEmailStatus: lastEmail?.status ?? null,
    };
  });

  const deadJobs = proposal.jobs.filter((job) => job.status === "DEAD");
  const hasFinalPdf = proposal.documents.some((doc) => doc.isFinal);
  const clientParties = proposal.parties.filter((p) => p.role === "CLIENT_SIGNER");
  const rslaParty = proposal.parties.find((p) => p.role === "ADMIN_SIGNER");
  const signedIds = new Set(proposal.signatures.map((sig) => sig.partyId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">{proposal.title}</h1>
            <StatusChip status={proposal.status} />
            <PaymentChip paymentStatus={proposal.paymentStatus} status={proposal.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tokens["Client.FirstName"]} {tokens["Client.LastName"]} · {tokens["Client.Company"]}
            {proposal.validUntil ? ` · valid until ${formatDate(proposal.validUntil)}` : ""}
            {proposal.versionNumber > 1 ? ` · v${proposal.versionNumber}` : ""}
          </p>
          {proposal.parent ? (
            <p className="text-xs text-muted-foreground">
              Revision of{" "}
              <Link href={`/proposals/${proposal.parent.id}`} className="underline">
                v{proposal.parent.versionNumber}
              </Link>
            </p>
          ) : null}
          {proposal.revisions.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Superseded by{" "}
              {proposal.revisions.map((rev, i) => (
                <Link key={rev.id} href={`/proposals/${rev.id}`} className="underline">
                  {i > 0 ? ", " : ""}v{rev.versionNumber}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
        <ProposalActions
          proposalId={proposal.id}
          status={proposal.status}
          paymentStatus={proposal.paymentStatus}
          hasFinalPdf={hasFinalPdf}
          isAdmin={viewer.role === "ADMIN"}
        />
      </div>

      {deadJobs.length > 0 ? (
        <Card className="border-destructive/40 bg-rose-50">
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm font-semibold text-destructive">
              {deadJobs.length} background task{deadJobs.length > 1 ? "s" : ""} failed permanently
            </p>
            {deadJobs.map((job) => (
              <form
                key={job.id}
                action={async () => {
                  "use server";
                  await retryJob(job.id);
                }}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate">
                  {job.jobType} · {job.lastError?.slice(0, 120) ?? "unknown error"}
                </span>
                <Button size="sm" variant="secondary" type="submit">
                  Retry
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="preview">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="pt-4">
          <div className="rounded-2xl bg-surface p-2 sm:p-6">
            <ProposalView
              sections={sections}
              selectedTierId={proposal.selectedTierId}
              tiersReadOnly
              selectedAddOnIds={selectedAddOnIds}
              addOnsReadOnly
              clientSlots={
                clientParties.length > 0
                  ? clientParties.map((p) => ({
                      name: p.name,
                      detail: tokens["Client.Company"],
                      signedAt: p.signedAt ? formatDate(p.signedAt) : null,
                      signatureImageUrl: signedIds.has(p.id)
                        ? `/api/proposals/${proposal.id}/signature/${p.id}`
                        : null,
                    }))
                  : [
                      // Draft: parties exist only after send, so preview the
                      // signature spaces from the imported tokens.
                      {
                        name: `${tokens["Client.FirstName"]} ${tokens["Client.LastName"]}`,
                        detail: tokens["Client.Company"],
                        signedAt: null,
                        signatureImageUrl: null,
                      },
                    ]
              }
              rslaSlot={{
                name: "Rahul Lalia",
                detail: "Managing Member, RSL/A LLC",
                signedAt: rslaParty?.signedAt ? formatDate(rslaParty.signedAt) : null,
                signatureImageUrl:
                  rslaParty && signedIds.has(rslaParty.id)
                    ? `/api/proposals/${proposal.id}/signature/${rslaParty.id}`
                    : null,
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="parties" className="pt-4">
          <PartyList
            parties={partyRows}
            proposalOpen={["SENT", "VIEWED", "PARTIALLY_SIGNED"].includes(proposal.status)}
          />
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <AuditTimeline
                events={proposal.auditEvents}
                parties={proposal.parties}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          {proposal.documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              The executed PDF appears here once all parties have signed.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-white">
              {proposal.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {doc.isFinal ? "Executed agreement (current)" : "Superseded copy"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateTime(doc.generatedAt)} · {(doc.sizeBytes / 1024).toFixed(0)} KB ·
                      SHA-256 {doc.sha256.slice(0, 16)}…
                    </p>
                  </div>
                  {doc.isFinal ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      nativeButton={false} render={<a href={`/api/proposals/${proposal.id}/pdf`} />}
                    >
                      Download
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {proposal.contentHash ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Content hash (frozen at send): <span className="font-mono">{proposal.contentHash}</span>
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
