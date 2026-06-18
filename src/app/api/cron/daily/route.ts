import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/audit";
import { sendTemplateEmail } from "@/lib/email";
import { rotatePartyToken } from "@/lib/partyTokens";
import { isAuthorizedCron, logCronRun } from "@/lib/cronAuth";

export const maxDuration = 60;

/** Daily sweep: expire stale proposals, send 3-day and 1-day signing reminders. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  try {
    const now = new Date();

    // 1) Expire. Per-iteration isolation (RSL-16): one proposal's failure — including a failed
    // expiry-notice send — must never abort the remaining expirations or the reminder pass. The
    // notice is queue-backed (sendTemplateEmail self-heals via a SEND_EMAIL retry job), so a
    // committed EXPIRED never goes silent.
    const toExpire = await prisma.proposal.findMany({
      where: {
        status: { in: ["SENT", "VIEWED", "PARTIALLY_SIGNED"] },
        validUntil: { lt: now },
      },
      take: 50,
    });
    let expired = 0;
    for (const proposal of toExpire) {
      try {
        await prisma.$transaction([
          prisma.proposal.update({
            where: { id: proposal.id },
            data: { status: "EXPIRED" },
          }),
          prisma.party.updateMany({
            where: { proposalId: proposal.id, signedAt: null },
            data: { tokenExpiresAt: now },
          }),
        ]);
        expired++;
        await logEvent({ proposalId: proposal.id, eventType: "PROPOSAL_EXPIRED" });
        await sendTemplateEmail("expired_admin", proposal.id, null, {});
      } catch (error) {
        console.error("daily cron: expire failed for", proposal.id, error);
      }
    }

    // 2) Remind at 3 days and 1 day before expiry
    let reminders = 0;
    const open = await prisma.proposal.findMany({
      where: {
        status: { in: ["SENT", "VIEWED", "PARTIALLY_SIGNED"] },
        validUntil: { gt: now },
      },
      include: { parties: true },
      take: 100,
    });
    for (const proposal of open) {
      const daysLeft = Math.ceil((proposal.validUntil!.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft !== 3 && daysLeft !== 1) continue;
      for (const party of proposal.parties) {
        if (party.role !== "CLIENT_SIGNER" || party.signedAt || party.declinedAt) continue;
        if (party.emailBounced || party.emailComplained) continue;
        try {
          // Dedup PER (party, daysLeft), not just per template (RSL-16): the 3-day reminder must
          // not suppress the 1-day "last day" nudge. Keyed on the REMINDER_SENT audit event
          // (which records daysLeft) within a sub-24h window so a threshold fires at most once.
          const recent = await prisma.auditEvent.findFirst({
            where: {
              partyId: party.id,
              eventType: "REMINDER_SENT",
              metadata: { path: ["daysLeft"], equals: daysLeft },
              occurredAt: { gt: new Date(now.getTime() - 20 * 3_600_000) },
            },
          });
          if (recent) continue;
          const rawToken = await rotatePartyToken(party.id);
          await sendTemplateEmail("signing_reminder", proposal.id, party.id, { rawToken, daysLeft });
          await logEvent({
            proposalId: proposal.id,
            partyId: party.id,
            eventType: "REMINDER_SENT",
            metadata: { daysLeft, automatic: true },
          });
          reminders++;
        } catch (error) {
          console.error("daily cron: reminder failed for", party.id, error);
        }
      }
    }

    await logCronRun(
      "/api/cron/daily",
      started,
      true,
      `expired=${expired} reminders=${reminders}`
    );
    return NextResponse.json({ expired, reminders });
  } catch (error) {
    await logCronRun("/api/cron/daily", started, false, String(error).slice(0, 300));
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
