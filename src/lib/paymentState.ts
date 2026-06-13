import type Stripe from "stripe";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/audit";
import { enqueueJob } from "@/lib/jobs";
import { runJobNow } from "@/lib/jobRunner";
import { sendTemplateEmail } from "@/lib/email";
import { computeDepositSchedule } from "@/lib/proposalContent";
import { formatCents } from "@/lib/currency";
import type { PaymentConfig } from "@/lib/types";

/**
 * Records a webhook (or synthetic reconcile) event exactly once.
 * Returns false when this externalId was already processed.
 */
export async function recordWebhookOnce(input: {
  source: "stripe" | "resend";
  externalId: string;
  eventType: string;
  proposalId?: string | null;
}): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({
      data: {
        source: input.source,
        externalId: input.externalId,
        eventType: input.eventType,
        proposalId: input.proposalId ?? null,
      },
    });
    return true;
  } catch (error) {
    // Unique violation = duplicate delivery / replay.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Shared paid-state transition for webhook, async-payment, and reconcile paths.
 * Status-guarded: never downgrades, never double-fires side effects.
 */
export async function applyPaidState(
  proposalId: string,
  session: Stripe.Checkout.Session
): Promise<void> {
  const updated = await prisma.proposal.updateMany({
    where: { id: proposalId, paymentStatus: { not: "PAID" } },
    data: { paymentStatus: "PAID", paidAt: new Date() },
  });
  if (updated.count === 0) return; // already paid — side effects already ran

  await prisma.payment.upsert({
    where: { proposalId },
    create: {
      proposalId,
      stripeSessionId: session.id,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : null,
      amountTotalCents: session.amount_total ?? null,
      currency: session.currency ?? "usd",
      paymentMethod: session.payment_method_types?.[0] ?? null,
      status: "paid",
      paidAt: new Date(),
    },
    update: {
      status: "paid",
      paidAt: new Date(),
      amountTotalCents: session.amount_total ?? null,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : null,
    },
  });

  await logEvent({
    proposalId,
    eventType: "PAYMENT_PAID",
    metadata: { sessionId: session.id, amountTotalCents: session.amount_total },
  });

  after(async () => {
    const notionJob = await enqueueJob({
      jobType: "NOTION_SYNC",
      proposalId,
      payload: { proposalId, kind: "paid" },
    });
    const metadataJob = await enqueueJob({
      jobType: "STRIPE_METADATA",
      proposalId,
      payload: { proposalId },
    });

    // On a deposit deal only the deposit was charged — the receipt must say so.
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    let depositNote: string | undefined;
    if (proposal) {
      const frozen = proposal.frozenContent as { paymentConfig?: PaymentConfig } | null;
      const config = (frozen?.paymentConfig ?? proposal.paymentConfig) as PaymentConfig;
      const schedule = computeDepositSchedule(config, proposal.selectedTierId);
      if (schedule) {
        const remaining =
          schedule.remainingCents != null
            ? `The remaining ${formatCents(schedule.remainingCents)} is collected when the build is complete.`
            : "The balance is collected when the build is complete.";
        const retainer = schedule.deferredRecurring
          ? ` Your ${schedule.deferredRecurring.displayString} retainer starts when work begins.`
          : "";
        depositNote = `This is your ${schedule.depositPercent}% deposit. ${remaining}${retainer}`;
      }
    }

    const payer = await prisma.party.findFirst({
      where: { proposalId, role: "CLIENT_SIGNER", payer: true },
    });
    if (payer) {
      await sendTemplateEmail("payment_received_client", proposalId, payer.id, {
        amountCents: session.amount_total ?? undefined,
        depositNote,
      });
    }
    await sendTemplateEmail("payment_received_admin", proposalId, null, {
      amountCents: session.amount_total ?? undefined,
      depositNote,
    });

    await runJobNow(notionJob.id);
    await runJobNow(metadataJob.id);
  });
}
