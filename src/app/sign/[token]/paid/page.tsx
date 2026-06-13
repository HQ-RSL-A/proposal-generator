import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Link2Off } from "lucide-react";
import { OUTCOME_COPY } from "@/lib/outcomeCopy";

export const dynamic = "force-dynamic";

/** Stripe Checkout success_url lands here. The webhook is the source of truth. */
export default async function PaidPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const { session_id: sessionId } = await searchParams;
  const gate = await gateToken(token);

  // Identify the proposal by token, or by the Stripe session id if the token
  // was rotated while the client sat in checkout. Someone returning from a
  // successful payment must never see a dead-link screen.
  let proposalId: string | null = gate.ok ? gate.party.proposalId : null;
  if (!proposalId && sessionId && /^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    const bySession = await prisma.proposal.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
      select: { id: true },
    });
    proposalId = bySession?.id ?? null;
  }

  if (!proposalId) {
    return (
      <OutcomeCard icon={Link2Off} tone="neutral" title={OUTCOME_COPY.invalidLink.title}>
        <p>{OUTCOME_COPY.invalidLink.body}</p>
      </OutcomeCard>
    );
  }

  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    select: { id: true, paymentStatus: true },
  });
  const finalDoc = await prisma.generatedDocument.findFirst({
    where: { proposalId: proposal.id, isFinal: true },
    select: { id: true },
  });

  // The download endpoint is token-gated; without a live token the executed
  // copy is already waiting in their inbox.
  const downloadButton =
    finalDoc && gate.ok ? (
      <div className="pt-3">
        <Button
          className="w-full"
          nativeButton={false}
          render={<a href={`/api/sign/${token}/document`} />}
        >
          Download your signed agreement
        </Button>
      </div>
    ) : (
      <p>
        Your executed copy is in your inbox as an attachment, so you always have it on hand.
      </p>
    );

  if (proposal.paymentStatus === "PROCESSING") {
    return (
      <OutcomeCard icon={Clock} tone="wait" title={OUTCOME_COPY.paymentProcessing.title}>
        <p>{OUTCOME_COPY.paymentProcessing.body}</p>
        {downloadButton}
      </OutcomeCard>
    );
  }

  return (
    <OutcomeCard icon={CheckCircle2} tone="success" title={OUTCOME_COPY.paymentConfirmed.title}>
      <p>{OUTCOME_COPY.paymentConfirmed.body}</p>
      {downloadButton}
    </OutcomeCard>
  );
}
