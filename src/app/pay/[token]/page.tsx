import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { ensureCheckoutSession } from "@/lib/signingService";
import { OutcomeCard } from "@/components/signing/outcomeCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Payment recovery: signed-but-unpaid proposals get a fresh Checkout Session here. */
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gate = await gateToken(token);

  if (!gate.ok) {
    return (
      <OutcomeCard icon="🔗" title="This link isn't valid">
        <p>Check the most recent email from RSL/A, or ask for a fresh payment link.</p>
      </OutcomeCard>
    );
  }

  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: gate.party.proposalId },
  });

  if (proposal.paymentStatus === "PAID") {
    return (
      <OutcomeCard icon="✅" title="Already paid">
        <p>This engagement is paid up. Nothing more to do. Your receipt is in your inbox.</p>
      </OutcomeCard>
    );
  }
  if (proposal.paymentStatus === "PROCESSING") {
    return (
      <OutcomeCard icon="🏦" title="Payment processing">
        <p>
          Your bank transfer is in progress. ACH takes 1 to 2 business days, and we&apos;ll email you
          the moment it clears.
        </p>
      </OutcomeCard>
    );
  }
  if (proposal.status !== "SIGNED" || proposal.paymentStatus === "NOT_REQUIRED") {
    return (
      <OutcomeCard icon="🖊️" title="Signature comes first">
        <p>This proposal isn&apos;t ready for payment yet. Finish signing from your email link first.</p>
      </OutcomeCard>
    );
  }

  let checkoutUrl: string | null = null;
  try {
    checkoutUrl = await ensureCheckoutSession(proposal.id, token);
  } catch (error) {
    console.error("pay page checkout error", error);
  }

  if (!checkoutUrl) {
    return (
      <OutcomeCard icon="⚠️" title="Checkout hiccup">
        <p>
          We couldn&apos;t open a payment session just now. Refresh this page to try again, or email{" "}
          <a className="underline" href="mailto:lalia@rsla.io">
            lalia@rsla.io
          </a>
          .
        </p>
      </OutcomeCard>
    );
  }

  redirect(checkoutUrl);
}
