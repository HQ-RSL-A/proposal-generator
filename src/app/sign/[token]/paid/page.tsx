import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Landmark, Link2Off } from "lucide-react";

export const dynamic = "force-dynamic";

/** Stripe Checkout success_url lands here. The webhook is the source of truth. */
export default async function PaidPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gate = await gateToken(token);

  if (!gate.ok) {
    return (
      <OutcomeCard icon={Link2Off} tone="neutral" title="This link isn't valid">
        <p>Check the most recent email from RSL/A, or ask for a fresh link.</p>
      </OutcomeCard>
    );
  }

  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: gate.party.proposalId },
    select: { id: true, paymentStatus: true },
  });
  const finalDoc = await prisma.generatedDocument.findFirst({
    where: { proposalId: proposal.id, isFinal: true },
    select: { id: true },
  });

  const downloadButton = finalDoc ? (
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
      <OutcomeCard icon={Landmark} tone="wait" title="Your bank transfer is on its way">
        <p>
          ACH takes 1 to 2 business days to clear, and we confirm by email the moment it lands.
          Your fully signed agreement is already in your inbox, and work gets scheduled in the
          meantime.
        </p>
        {downloadButton}
      </OutcomeCard>
    );
  }

  return (
    <OutcomeCard icon={CheckCircle2} tone="success" title="You're all set">
      <p>
        Your payment went through, and a confirmation email is on its way to you. The fully signed
        agreement was sent to your inbox the moment everyone signed, so everything you agreed to is
        already in your hands.
      </p>
      {downloadButton}
    </OutcomeCard>
  );
}
