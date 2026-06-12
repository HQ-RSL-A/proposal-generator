import { NextResponse, after, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/audit";
import { enqueueJob } from "@/lib/jobs";
import { runJobNow } from "@/lib/jobRunner";
import { applyPaidState, recordWebhookOnce } from "@/lib/paymentState";

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

  const fresh = await recordWebhookOnce({
    source: "stripe",
    externalId: event.id,
    eventType: event.type,
    proposalId,
  });
  if (!fresh) return NextResponse.json({ received: true, duplicate: true });

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
  }

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
