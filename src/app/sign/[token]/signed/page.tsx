import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PenLine } from "lucide-react";

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
    const finalDoc = allSigned
      ? await prisma.generatedDocument.findFirst({
          where: { proposalId: proposal.id, isFinal: true },
          select: { id: true },
        })
      : null;
    return (
      <OutcomeCard
        icon={allSigned ? CheckCircle2 : PenLine}
        tone="success"
        title={allSigned ? "Everything is signed" : "Your signature is in"}
      >
        <p>
          {allSigned
            ? "All parties have signed, and the agreement is in effect. Your executed copy, signature certificate included, is on its way to your inbox."
            : "Thanks for signing. We are waiting on the remaining signatures, and the moment everyone has signed you will receive the fully executed copy by email."}
        </p>
        {paymentOpen && gate.party.payer ? (
          <div className="pt-3">
            <Button className="w-full" nativeButton={false} render={<a href={`/pay/${token}`} />}>
              Complete payment
            </Button>
          </div>
        ) : null}
        {finalDoc ? (
          <div className="pt-3">
            <Button
              className="w-full"
              variant={paymentOpen && gate.party.payer ? "outline" : "default"}
              nativeButton={false}
              render={<a href={`/api/sign/${token}/document`} />}
            >
              Download your signed agreement
            </Button>
          </div>
        ) : null}
      </OutcomeCard>
    );
  }

  return (
    <OutcomeCard icon={CheckCircle2} tone="success" title="All set">
      <p>If you just signed, your confirmation and executed copy will arrive by email.</p>
    </OutcomeCard>
  );
}
