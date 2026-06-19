import { NextResponse, after, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/audit";
import { enqueueJob } from "@/lib/jobs";
import { runJobNow } from "@/lib/jobRunner";
import { applyPaidState, markWebhookProcessed, wasWebhookProcessed } from "@/lib/paymentState";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const proposalId =
    (session.metadata?.proposalId as string | undefined) ??
    (await proposalIdFromSession(session));

  // Process-then-record (RSL-6): skip only events we've already FINISHED. The
  // marker is written after the switch below, so a transient failure mid-handler
  // throws before marking and Stripe's retry re-runs the work. Exactly-once is
  // still guaranteed by the status-guarded transitions inside each handler.
  if (await wasWebhookProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      if (!proposalId) break;
      if (session.payment_status === "paid") {
        await applyPaidState(proposalId, session);
      } else {
        // ACH microdeposits etc. — legally signed, money in transit. First-class state.
        await prisma.proposal.updateMany({
          where: { id: proposalId, paymentStatus: { in: ["AWAITING", "SESSION_EXPIRED", "FAILED"] } },
          data: { paymentStatus: "PROCESSING" },
        });
        await logEvent({
          proposalId,
          eventType: "PAYMENT_PROCESSING",
          metadata: { sessionId: session.id },
        });
      }
      break;
    }

    case "checkout.session.async_payment_succeeded": {
      if (!proposalId) break;
      await applyPaidState(proposalId, session);
      break;
    }

    case "checkout.session.async_payment_failed": {
      if (!proposalId) break;
      await prisma.proposal.updateMany({
        where: { id: proposalId, paymentStatus: { not: "PAID" } },
        data: { paymentStatus: "FAILED" },
      });
      await logEvent({
        proposalId,
        eventType: "PAYMENT_FAILED",
        metadata: { sessionId: session.id },
      });
      after(async () => {
        const payer = await prisma.party.findFirst({
          where: { proposalId, role: "CLIENT_SIGNER", payer: true },
        });
        if (payer) {
          const job = await enqueueJob({
            jobType: "SEND_EMAIL",
            proposalId,
            payload: {
              templateId: "payment_failed_client",
              proposalId,
              partyId: payer.id,
              context: {},
              needsToken: true,
              // RSL-28: a deterministic, event-derived Resend key so a reaper re-run of this
              // first-send reuses it and can't double-deliver (a duplicate EmailLog row is harmless).
              idempotencyKey: `emailkey-${event.id}-payment_failed_client`,
            },
          });
          await runJobNow(job.id);
        }
        const { sendTemplateEmail } = await import("@/lib/email");
        await sendTemplateEmail("payment_failed_admin", proposalId, null, {});
      });
      break;
    }

    case "checkout.session.expired": {
      if (!proposalId) break;
      const updated = await prisma.proposal.updateMany({
        where: { id: proposalId, paymentStatus: "AWAITING" },
        data: { paymentStatus: "SESSION_EXPIRED" },
      });
      if (updated.count > 0) {
        await logEvent({
          proposalId,
          eventType: "CHECKOUT_EXPIRED",
          metadata: { sessionId: session.id },
        });
        after(async () => {
          const payer = await prisma.party.findFirst({
            where: { proposalId, role: "CLIENT_SIGNER", payer: true },
          });
          if (payer) {
            const job = await enqueueJob({
              jobType: "SEND_EMAIL",
              proposalId,
              payload: {
                templateId: "payment_link",
                proposalId,
                partyId: payer.id,
                context: {},
                needsToken: true,
                // RSL-28: deterministic Resend key — see the async_payment_failed handler above.
                idempotencyKey: `emailkey-${event.id}-payment_link`,
              },
            });
            await runJobNow(job.id);
          }
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      // Ongoing subscription health: map invoice -> proposal via stored subscription id.
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof (invoice as unknown as { subscription?: string }).subscription === "string"
          ? (invoice as unknown as { subscription: string }).subscription
          : ((invoice.parent as { subscription_details?: { subscription?: string } } | null)
              ?.subscription_details?.subscription ?? null);
      if (!subId) break;
      const payment = await prisma.payment.findFirst({
        where: { stripeSubscriptionId: subId },
      });
      if (!payment) break;
      await logEvent({
        proposalId: payment.proposalId,
        eventType: "PAYMENT_FAILED",
        metadata: { kind: "subscription_invoice", invoiceId: invoice.id },
      });
      after(async () => {
        const { sendTemplateEmail } = await import("@/lib/email");
        await sendTemplateEmail("payment_failed_admin", payment.proposalId, null, {});
      });
      break;
    }

    case "invoice.paid": {
      // Subscription renewals. The first charge is covered by
      // checkout.session.completed; billing_reason filters it out so the receipt
      // isn't sent twice. Renewals don't change paymentStatus (already PAID) — they
      // just owe the client a receipt for that month's charge.
      const invoice = event.data.object as Stripe.Invoice;
      const billingReason = (invoice as unknown as { billing_reason?: string }).billing_reason;
      if (billingReason !== "subscription_cycle") break;

      const subId =
        typeof (invoice as unknown as { subscription?: string }).subscription === "string"
          ? (invoice as unknown as { subscription: string }).subscription
          : ((invoice.parent as { subscription_details?: { subscription?: string } } | null)
              ?.subscription_details?.subscription ?? null);
      if (!subId) break;
      const payment = await prisma.payment.findFirst({
        where: { stripeSubscriptionId: subId },
      });
      if (!payment) break;

      const amountPaidCents = invoice.amount_paid ?? undefined;
      await logEvent({
        proposalId: payment.proposalId,
        eventType: "PAYMENT_PAID",
        metadata: { kind: "subscription_renewal", invoiceId: invoice.id, amountPaidCents },
      });
      after(async () => {
        const { sendTemplateEmail } = await import("@/lib/email");
        const payer = await prisma.party.findFirst({
          where: { proposalId: payment.proposalId, role: "CLIENT_SIGNER", payer: true },
        });
        if (payer) {
          await sendTemplateEmail("payment_received_client", payment.proposalId, payer.id, {
            amountCents: amountPaidCents,
          });
        }
        await sendTemplateEmail("payment_received_admin", payment.proposalId, null, {
          amountCents: amountPaidCents,
        });
      });
      break;
    }
  }

  // Reached only when the handler above didn't throw. Mark processed now so a
  // future redelivery of this same event id is skipped at the pre-check.
  await markWebhookProcessed({
    source: "stripe",
    externalId: event.id,
    eventType: event.type,
    proposalId,
  });

  return NextResponse.json({ received: true });
}

async function proposalIdFromSession(session: Stripe.Checkout.Session): Promise<string | undefined> {
  if (!session.id) return undefined;
  const proposal = await prisma.proposal.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: { id: true },
  });
  return proposal?.id;
}
