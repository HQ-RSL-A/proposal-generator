import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { ensureCheckoutSession } from "@/lib/signingService";
import { OutcomeCard } from "@/components/signing/outcomeCard";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { AlertTriangle, CheckCircle2, Clock, Link2Off, PenLine } from "lucide-react";
import { OUTCOME_COPY } from "@/lib/outcomeCopy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Payment recovery: signed-but-unpaid proposals get a fresh Checkout Session here. */
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const { session_id: sessionId } = await searchParams;
  const gate = await gateToken(token);

  // Identify the proposal by token, or by the Stripe session id if the token was rotated while
  // the client sat in checkout. A client returning to retry payment must never hit a dead link —
  // the same self-heal the /paid success page has (RSL-14).
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
  });

  if (proposal.paymentStatus === "PAID") {
    return (
      <OutcomeCard icon={CheckCircle2} tone="success" title={OUTCOME_COPY.paymentConfirmed.title}>
        <p>{OUTCOME_COPY.paymentConfirmed.body}</p>
      </OutcomeCard>
    );
  }
  if (proposal.paymentStatus === "PROCESSING") {
    return (
      <OutcomeCard icon={Clock} tone="wait" title={OUTCOME_COPY.paymentProcessing.title}>
        <p>{OUTCOME_COPY.paymentProcessing.body}</p>
      </OutcomeCard>
    );
  }
  if (proposal.paymentStatus === "MANUAL_INVOICE") {
    // Manual-invoice deals collect nothing online — never mint a session; show a benign confirmation.
    return (
      <OutcomeCard icon={CheckCircle2} tone="success" title="You're all set">
        <p>
          This agreement is signed and in effect. There&apos;s nothing to pay here, we&apos;ll be in
          touch directly about next steps.
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
