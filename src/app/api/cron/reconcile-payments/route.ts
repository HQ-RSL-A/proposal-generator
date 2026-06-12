import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveSession } from "@/lib/stripe";
import { applyPaidState, recordWebhookOnce } from "@/lib/paymentState";
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
          const fresh = await recordWebhookOnce({
            source: "stripe",
            externalId: `reconcile_${session.id}_paid`,
            eventType: "reconcile.paid",
            proposalId: proposal.id,
          });
          if (fresh) {
            await applyPaidState(proposal.id, session);
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
      `checked=${stuck.length} healed=${healed}`
    );
    return NextResponse.json({ checked: stuck.length, healed });
  } catch (error) {
    await logCronRun("/api/cron/reconcile-payments", started, false, String(error).slice(0, 300));
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
