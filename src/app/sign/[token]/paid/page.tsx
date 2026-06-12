import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { OutcomeCard } from "@/components/signing/outcomeCard";

export const dynamic = "force-dynamic";

/** Stripe Checkout success_url lands here. The webhook is the source of truth. */
export default async function PaidPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gate = await gateToken(token);

  let processing = false;
  if (gate.ok) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: gate.party.proposalId },
      select: { paymentStatus: true },
    });
    processing = proposal?.paymentStatus === "PROCESSING";
  }

  return (
    <OutcomeCard icon={processing ? "🏦" : "🎉"} title={processing ? "Payment processing" : "You're all set"}>
      {processing ? (
        <p>
          Your bank transfer is on its way. ACH takes 1 to 2 business days to clear, and we&apos;ll
          confirm by email the moment it lands. Work gets scheduled right away.
        </p>
      ) : (
        <p>
          Payment received (or finishing up). A confirmation email and your kickoff details are on
          the way. Welcome aboard. We&apos;re excited to build this.
        </p>
      )}
    </OutcomeCard>
  );
}
