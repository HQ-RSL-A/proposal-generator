import { prisma } from "@/lib/prisma";
import { claimJobs, completeJob, failJob } from "@/lib/jobs";
import { sendTemplateEmail, type EmailTemplateId } from "@/lib/email";
import { rotatePartyToken } from "@/lib/partyTokens";
import { generateAndStorePdf } from "@/lib/generatePdf";
import { updateCrmOnPaid, noteOnSigned } from "@/lib/notion";
import { attachCustomerMetadata } from "@/lib/stripe";
import { logEvent } from "@/lib/audit";
import { effectiveLineItems, type PaymentConfig, type TokensJson } from "@/lib/types";
import type { PendingJob } from "@/generated/prisma/client";

async function executeJob(job: PendingJob): Promise<void> {
  const payload = job.payload as Record<string, unknown>;

  switch (job.jobType) {
    case "GENERATE_PDF": {
      const proposalId = payload.proposalId as string;
      // Skip when a final PDF already exists for the current completion.
      const existing = await prisma.generatedDocument.findFirst({
        where: { proposalId, isFinal: true },
      });
      if (existing) return;
      await generateAndStorePdf(proposalId);
      return;
    }

    case "SEND_EMAIL": {
      const templateId = payload.templateId as EmailTemplateId;
      const partyId = (payload.partyId as string | null) ?? null;
      const context = ((payload.context as Record<string, unknown>) ?? {}) as NonNullable<
        Parameters<typeof sendTemplateEmail>[3]
      >;
      if (payload.needsToken && partyId) {
        context.rawToken = await rotatePartyToken(partyId);
      }
      const result = await sendTemplateEmail(
        templateId,
        (payload.proposalId as string) ?? job.proposalId!,
        partyId,
        context,
        payload.emailLogId as string | undefined
      );
      if (!result.ok) throw new Error("Email send failed (will retry)");
      return;
    }

    case "NOTION_SYNC": {
      const proposalId = (payload.proposalId as string) ?? job.proposalId!;
      const proposal = await prisma.proposal.findUniqueOrThrow({
        where: { id: proposalId },
        include: { documents: { where: { isFinal: true } } },
      });
      const frozen = proposal.frozenContent as { tokens?: TokensJson; paymentConfig?: PaymentConfig } | null;
      const tokens = (frozen?.tokens ?? proposal.tokens) as TokensJson;
      const proposalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposal.id}`;

      if (payload.kind === "signed") {
        const { pageId } = await noteOnSigned({
          company: tokens["Client.Company"],
          proposalUrl,
        });
        if (pageId) {
          await prisma.proposal.update({ where: { id: proposalId }, data: { notionPageId: pageId } });
        }
      } else {
        const config = (frozen?.paymentConfig ?? proposal.paymentConfig) as PaymentConfig;
        const { oneTime, recurring } = effectiveLineItems(config, proposal.selectedTierId);
        const { pageId } = await updateCrmOnPaid({
          company: tokens["Client.Company"],
          monthlyFeeCents: recurring && recurring.intervalMonths === 1 ? recurring.amountCents : null,
          oneTimeFeeCents: oneTime?.amountCents ?? null,
          proposalUrl,
          signedPdfUrl: proposal.documents[0]?.blobUrl ?? null,
          stripeCustomerId: proposal.stripeCustomerId,
        });
        if (pageId) {
          await prisma.proposal.update({ where: { id: proposalId }, data: { notionPageId: pageId } });
        }
      }
      await logEvent({ proposalId, eventType: "NOTION_SYNCED", metadata: { kind: payload.kind ?? "paid" } });
      return;
    }

    case "STRIPE_METADATA": {
      const proposalId = (payload.proposalId as string) ?? job.proposalId!;
      const proposal = await prisma.proposal.findUniqueOrThrow({
        where: { id: proposalId },
        include: { documents: { where: { isFinal: true }, orderBy: { generatedAt: "desc" } }, msaVersion: true },
      });
      if (!proposal.stripeCustomerId) throw new Error("No Stripe customer on proposal");
      const finalDoc = proposal.documents[0];
      if (!finalDoc) throw new Error("Final PDF not generated yet"); // retried until it exists
      await attachCustomerMetadata(proposal.stripeCustomerId, {
        proposal_url: `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposal.id}`,
        signed_pdf: finalDoc.blobUrl,
        agreement_version: proposal.msaVersion.version,
        content_hash: proposal.contentHash ?? "",
        proposal_id: proposal.id,
      });
      await logEvent({ proposalId, eventType: "STRIPE_METADATA_ATTACHED" });
      return;
    }
  }
}

/** Claims and runs due jobs. Used by the cron sweep and opportunistic immediate runs. */
export async function processDueJobs(limit = 10): Promise<{ ran: number; failed: number }> {
  const jobs = await claimJobs(limit);
  let failed = 0;
  for (const job of jobs) {
    try {
      await executeJob(job);
      await completeJob(job.id);
    } catch (error) {
      failed++;
      await failJob(job, error);
    }
  }
  return { ran: jobs.length, failed };
}

/** Runs one specific job immediately if it's still pending (race-safe with the cron). */
export async function runJobNow(jobId: string): Promise<void> {
  const claimed = await prisma.$queryRaw<PendingJob[]>`
    UPDATE "proposals"."PendingJob"
    SET "status" = 'PROCESSING', "processingAt" = NOW(), "attempts" = "attempts" + 1, "updatedAt" = NOW()
    WHERE "id" = ${jobId} AND "status" = 'PENDING'
    RETURNING *
  `;
  if (claimed.length === 0) return;
  const job = claimed[0];
  try {
    await executeJob(job);
    await completeJob(job.id);
  } catch (error) {
    await failJob(job, error);
  }
}
