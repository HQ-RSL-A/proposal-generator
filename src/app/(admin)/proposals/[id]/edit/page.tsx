import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProposalForm } from "@/components/proposals/proposalForm";
import type { PaymentConfig } from "@/lib/types";
import { resolveTrackRecord } from "@/lib/trackRecord";

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) notFound();
  if (proposal.status !== "DRAFT") redirect(`/proposals/${id}`);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-heading mb-6 text-2xl font-bold">Edit draft</h1>
      <ProposalForm
        mode="edit"
        proposalId={proposal.id}
        initialTitle={proposal.title}
        initialTokens={proposal.tokens as Record<string, string>}
        initialConfig={proposal.paymentConfig as unknown as PaymentConfig}
        initialTrackRecord={resolveTrackRecord(proposal.trackRecord)}
      />
    </div>
  );
}
