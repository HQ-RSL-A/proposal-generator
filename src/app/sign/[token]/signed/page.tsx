import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SignedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gate = await gateToken(token);

  if (gate.ok && gate.party.signedAt) {
    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id: gate.party.proposalId },
    });
    const allSigned = proposal.status === "SIGNED";
    const paymentOpen =
      allSigned && ["AWAITING", "SESSION_EXPIRED", "FAILED"].includes(proposal.paymentStatus);
    return (
      <OutcomeCard icon="🎉" title="Signature applied">
        <p>
          {allSigned
            ? "All parties have signed — the agreement is fully executed. Your copy (with the signature certificate) is on its way to your inbox."
            : "Thanks! We're waiting on the remaining signatures. You'll receive the fully executed copy by email once everyone has signed."}
        </p>
        {paymentOpen && gate.party.payer ? (
          <div className="pt-3">
            <Button className="w-full" render={<a href={`/pay/${token}`} />}>
              Complete payment
            </Button>
          </div>
        ) : null}
      </OutcomeCard>
    );
  }

  return (
    <OutcomeCard icon="✅" title="All set">
      <p>If you just signed, your confirmation and executed copy will arrive by email.</p>
    </OutcomeCard>
  );
}
