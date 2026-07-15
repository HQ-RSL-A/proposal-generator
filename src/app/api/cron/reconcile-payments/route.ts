import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveSession } from "@/lib/stripe";
import { applyPaidState, markWebhookProcessed, wasWebhookProcessed } from "@/lib/paymentState";
import { isAuthorizedCron, logCronRun } from "@/lib/cronAuth";

export const maxDuration = 60;

/**
 * Heals missed webhooks: any signed proposal stuck in a non-terminal payment
 * state gets cross-checked against Stripe directly.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  try {
    const stuck = await prisma.proposal.findMany({
      where: {
        status: "SIGNED",
        paymentStatus: { in: ["AWAITING", "PROCESSING", "SESSION_EXPIRED", "FAILED"] },
        stripeCheckoutSessionId: { not: null },
        updatedAt: { lt: new Date(Date.now() - 30 * 60_000) },
      },
      take: 20,
    });

    let healed = 0;
    for (const proposal of stuck) {
      try {
        const session = await retrieveSession(proposal.stripeCheckoutSessionId!);
        if (session.payment_status === "paid") {
          // Process-then-record (RSL-6): heal first, mark after. If applyPaidState
          // throws, no marker is written, so a later cron run re-attempts the heal
          // instead of being deduped out.
          const externalId = `reconcile_${session.id}_paid`;
          if (!(await wasWebhookProcessed(externalId))) {
            await applyPaidState(proposal.id, session);
            await markWebhookProcessed({
              source: "stripe",
              externalId,
              eventType: "reconcile.paid",
              proposalId: proposal.id,
            });
            healed++;
          }
        } else if (session.status === "expired" && proposal.paymentStatus === "AWAITING") {
          await prisma.proposal.updateMany({
            where: { id: proposal.id, paymentStatus: "AWAITING" },
            data: { paymentStatus: "SESSION_EXPIRED" },
          });
        }
      } catch (error) {
        console.error("reconcile failed for", proposal.id, error);
      }
    }

    await logCronRun(
      "/api/cron/reconcile-payments",
      started,
      true,
      `checked=${stuck.length} healed=${healed}`,
      // Finding stuck payments is worth a row even when nothing healed.
      { noop: stuck.length === 0 }
    );
    return NextResponse.json({ checked: stuck.length, healed });
  } catch (error) {
    await logCronRun("/api/cron/reconcile-payments", started, false, String(error).slice(0, 300));
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
