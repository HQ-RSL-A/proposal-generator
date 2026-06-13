import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/audit";
import { recordWebhookOnce } from "@/lib/paymentState";

interface ResendWebhookPayload {
  type: string;
  data: { email_id?: string };
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  const payloadText = await request.text();
  const svixId = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";

  let payload: ResendWebhookPayload;
  try {
    payload = new Webhook(secret).verify(payloadText, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const emailId = payload.data?.email_id;
  if (!emailId) return NextResponse.json({ received: true });

  const log = await prisma.emailLog.findUnique({ where: { resendMessageId: emailId } });
  if (!log) return NextResponse.json({ received: true });

  const fresh = await recordWebhookOnce({
    source: "resend",
    externalId: `${svixId}:${payload.type}`,
    eventType: payload.type,
    proposalId: log.proposalId,
  });
  if (!fresh) return NextResponse.json({ received: true, duplicate: true });

  const now = new Date();
  switch (payload.type) {
    case "email.delivered":
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "DELIVERED", deliveredAt: now },
      });
      await logEvent({
        proposalId: log.proposalId,
        partyId: log.partyId,
        eventType: "EMAIL_DELIVERED",
        metadata: { templateId: log.templateId, recipient: log.recipient },
      });
      break;

    case "email.opened":
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "OPENED", openedAt: log.openedAt ?? now },
      });
      await logEvent({
        proposalId: log.proposalId,
        partyId: log.partyId,
        eventType: "EMAIL_OPENED",
        metadata: { templateId: log.templateId },
      });
      break;

    case "email.bounced":
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "BOUNCED", bouncedAt: now },
      });
      if (log.partyId) {
        await prisma.party.update({
          where: { id: log.partyId },
          data: { emailBounced: true },
        });
      }
      await logEvent({
        proposalId: log.proposalId,
        partyId: log.partyId,
        eventType: "EMAIL_BOUNCED",
        metadata: { templateId: log.templateId, recipient: log.recipient },
      });
      // A bounced email means the client never saw it. Surface immediately so
      // the address can be corrected and the email resent from the dashboard.
      {
        const { sendSystemAlert } = await import("@/lib/email");
        await sendSystemAlert({
          summary: `An email bounced: ${log.recipient}`,
          details: [
            { label: "Recipient", value: log.recipient },
            { label: "Email", value: log.templateId },
            { label: "Fix", value: "Correct the address on the proposal page, then resend" },
          ],
          dedupeKey: `bounce-${log.id}`,
          proposalId: log.proposalId,
        });
      }
      break;

    case "email.complained":
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "COMPLAINED" },
      });
      if (log.partyId) {
        await prisma.party.update({
          where: { id: log.partyId },
          data: { emailComplained: true },
        });
      }
      break;
  }

  return NextResponse.json({ received: true });
}
