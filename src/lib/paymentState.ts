import type Stripe from "stripe";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/audit";
import { enqueueJob } from "@/lib/jobs";
import { runJobNow } from "@/lib/jobRunner";
import { computeDepositSchedule } from "@/lib/proposalContent";
import { formatCents } from "@/lib/currency";
import type { PaymentConfig } from "@/lib/types";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * Records a webhook event exactly once, record-FIRST.
 * Returns false when this externalId was already processed.
 *
 * Only safe for handlers whose work is naturally idempotent and low-stakes
 * (e.g. Resend email-status updates). Payment paths must use the
 * process-then-record pair below: recording before the work means a transient
 * failure dedupes the retry into a permanent no-op (RSL-6).
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
    if (isUniqueViolation(error)) return false; // duplicate delivery / replay
    throw error;
  }
}

/** True if this external event id has already been fully processed. */
export async function wasWebhookProcessed(externalId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({ where: { externalId } });
  return existing !== null;
}

/**
 * Marks an external event processed — call only AFTER its work has succeeded
 * (process-then-record). Recording on success (not before) means a transient
 * failure leaves no marker, so Stripe's automatic retry (or the reconcile cron)
 * re-runs the handler instead of being deduped into a permanent no-op. The paid
 * transition itself stays exactly-once via the status-guarded `updateMany` in
 * `applyPaidState`, so a re-run is a safe no-op. Idempotent: a concurrent
 * duplicate marker is swallowed.
 */
export async function markWebhookProcessed(input: {
  source: "stripe" | "resend";
  externalId: string;
  eventType: string;
  proposalId?: string | null;
}): Promise<void> {
  try {
    await prisma.webhookEvent.create({
      data: {
        source: input.source,
        externalId: input.externalId,
        eventType: input.eventType,
        proposalId: input.proposalId ?? null,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return; // already recorded — fine
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
    // Every post-paid side effect goes through the durable queue. This block
    // runs after the 200, so a throw here can't be surfaced or retried by
    // Stripe — the queue is the only retry net. Receipts that were once sent
    // inline (and lost if a preceding read threw) are now jobs too (RSL-8).
    const enqueuedJobIds: string[] = [];
    enqueuedJobIds.push(
      (await enqueueJob({ jobType: "NOTION_SYNC", proposalId, payload: { proposalId, kind: "paid" } })).id
    );
    enqueuedJobIds.push(
      (await enqueueJob({ jobType: "STRIPE_METADATA", proposalId, payload: { proposalId } })).id
    );

    // On a deposit deal only the deposit was charged — the receipt should say
    // so. This read is best-effort: a failure must NOT block the receipt, so
    // it's caught and the receipt simply goes out without the deposit note
    // (RSL-8: the fragile read no longer gates the send).
    let depositNote: string | undefined;
    try {
      const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
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
    } catch (error) {
      console.error("deposit-note lookup failed; sending receipt without it", error);
    }

    const receiptContext = { amountCents: session.amount_total ?? undefined, depositNote };

    // Admin receipt (no party to resolve).
    enqueuedJobIds.push(
      (
        await enqueueJob({
          jobType: "SEND_EMAIL",
          proposalId,
          payload: {
            templateId: "payment_received_admin",
            proposalId,
            partyId: null,
            context: receiptContext,
          },
        })
      ).id
    );

    // Client receipt: enqueued unconditionally. The payer is resolved inside the job
    // (resolvePartyByRole) so a transient payer-lookup failure is retried by the queue
    // instead of aborting this post-200 after() block and stranding the receipt (RSL-27).
    enqueuedJobIds.push(
      (
        await enqueueJob({
          jobType: "SEND_EMAIL",
          proposalId,
          payload: {
            templateId: "payment_received_client",
            proposalId,
            resolvePartyByRole: "CLIENT_SIGNER_PAYER",
            context: receiptContext,
          },
        })
      ).id
    );

    // Opportunistic immediate runs; the cron is the safety net for any that
    // fail, and one failed run must not block the others.
    for (const id of enqueuedJobIds) {
      try {
        await runJobNow(id);
      } catch (error) {
        console.error("immediate job run failed; cron will retry", id, error);
      }
    }
  });
}
