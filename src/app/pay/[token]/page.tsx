import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { ensureCheckoutSession } from "@/lib/signingService";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { AlertTriangle, CheckCircle2, Landmark, Link2Off, PenLine } from "lucide-react";

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
      <OutcomeCard icon={Link2Off} tone="neutral" title="This link isn't valid">
        <p>Check the most recent email from RSL/A, or ask for a fresh payment link.</p>
      </OutcomeCard>
    );
  }

  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: gate.party.proposalId },
  });

  if (proposal.paymentStatus === "PAID") {
    return (
      <OutcomeCard icon={CheckCircle2} tone="success" title="Already paid">
        <p>This engagement is paid up. Nothing more to do here.</p>
      </OutcomeCard>
    );
  }
  if (proposal.paymentStatus === "PROCESSING") {
    return (
      <OutcomeCard icon={Landmark} tone="wait" title="Your bank transfer is on its way">
        <p>
          ACH takes 1 to 2 business days to clear, and we email you the moment it lands. No
          further action needed.
        </p>
      </OutcomeCard>
    );
  }
  if (proposal.status !== "SIGNED" || proposal.paymentStatus === "NOT_REQUIRED") {
    return (
      <OutcomeCard icon={PenLine} tone="info" title="Signature comes first">
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
      <OutcomeCard icon={AlertTriangle} tone="error" title="Checkout didn't open">
        <p>
          We couldn&apos;t start a payment session just now. Refresh this page to try again, or
          write to{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          and we&apos;ll sort it out.
        </p>
      </OutcomeCard>
    );
  }

  redirect(checkoutUrl);
}
