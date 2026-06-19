import { prisma } from "@/lib/prisma";
import { claimJobs, completeJob, failJob, reapStuckJobs } from "@/lib/jobs";
import { sendTemplateEmail, type EmailTemplateId } from "@/lib/email";
import { rotatePartyToken, isPayerTokenInFlight } from "@/lib/partyTokens";
import { generateAndStorePdf } from "@/lib/generatePdf";
import { updateCrmOnPaid, noteOnSigned } from "@/lib/notion";
import { attachCustomerMetadata } from "@/lib/stripe";
import { logEvent } from "@/lib/audit";
import { effectiveLineItems, type PaymentConfig, type TokensJson } from "@/lib/types";
import { monthlyRecurringCents } from "@/lib/dashboardMetrics";
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
      let partyId = (payload.partyId as string | null) ?? null;
      // RSL-27: resolve the payer at execution time when asked, so a transient payer lookup
      // can't strand the client receipt — the durable queue retries it instead of the read
      // silently aborting applyPaidState's post-200 after() block.
      if (!partyId && payload.resolvePartyByRole === "CLIENT_SIGNER_PAYER") {
        const payer = await prisma.party.findFirst({
          where: {
            proposalId: (payload.proposalId as string) ?? job.proposalId!,
            role: "CLIENT_SIGNER",
            payer: true,
          },
        });
        if (!payer) return; // no payer to receipt (sign-only / admin-pays) — clean no-op
        partyId = payer.id;
      }
      const context = ((payload.context as Record<string, unknown>) ?? {}) as NonNullable<
        Parameters<typeof sendTemplateEmail>[3]
      >;
      if (payload.needsToken && partyId) {
        // Don't rotate the payer's token while their checkout is in flight: a retry of a failed
        // payer email would otherwise invalidate the live success_url/cancel_url they hold. Same
        // payer-identity guard as the executed-copy email, never keyed on signer order (RSL-14).
        const party = await prisma.party.findUnique({
          where: { id: partyId },
          include: { proposal: true },
        });
        if (!party || !isPayerTokenInFlight(party, party.proposal.paymentStatus)) {
          context.rawToken = await rotatePartyToken(partyId);
        }
      }
      const result = await sendTemplateEmail(
        templateId,
        (payload.proposalId as string) ?? job.proposalId!,
        partyId,
        context,
        payload.emailLogId as string | undefined,
        payload.idempotencyKey as string | undefined
      );
      if (!result.ok) throw new Error("Email send failed (will retry)");
      return;
    }

    case "NOTION_SYNC": {
      const proposalId = (payload.proposalId as string) ?? job.proposalId!;
      const kind = (payload.kind as string) ?? "paid";

      // Idempotency (RSL-15): the Notion block append is not natively idempotent, so a retry
      // after a post-append throw would write a SECOND "Signed & paid" block and re-PATCH the
      // fees. Skip if this kind of sync already recorded its marker. The marker (logEvent below)
      // is written immediately after the append, so the only re-append window is the marker
      // write itself failing — far smaller than re-running on any later step (process-then-record,
      // per the RSL-6 family principle).
      const alreadySynced = await prisma.auditEvent.findFirst({
        where: { proposalId, eventType: "NOTION_SYNCED", metadata: { path: ["kind"], equals: kind } },
      });
      if (alreadySynced) return;

      const proposal = await prisma.proposal.findUniqueOrThrow({
        where: { id: proposalId },
        include: { documents: { where: { isFinal: true } } },
      });
      const frozen = proposal.frozenContent as { tokens?: TokensJson; paymentConfig?: PaymentConfig } | null;
      const tokens = (frozen?.tokens ?? proposal.tokens) as TokensJson;
      const proposalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposal.id}`;

      if (kind === "signed") {
        const { pageId } = await noteOnSigned({
          company: tokens["Client.Company"],
          proposalUrl,
        });
        await logEvent({ proposalId, eventType: "NOTION_SYNCED", metadata: { kind: "signed" } });
        if (pageId) {
          await prisma.proposal.update({ where: { id: proposalId }, data: { notionPageId: pageId } });
        }
      } else {
        const config = (frozen?.paymentConfig ?? proposal.paymentConfig) as PaymentConfig;
        // Notion records the full contract value (base + selected add-ons), net of any discount
        // (amountCents is already the net), never the deposit.
        const { oneTime, recurring } = effectiveLineItems(config, proposal.selectedTierId);
        const selectedAddOnIds = (proposal.selectedAddOnIds as unknown as string[] | null) ?? [];
        const selectedAddOns = (config.addOns ?? []).filter((a) => selectedAddOnIds.includes(a.id));
        const addOnOneTimeCents = selectedAddOns
          .filter((a) => a.intervalMonths === null)
          .reduce((sum, a) => sum + a.amountCents, 0);
        const oneTimeTotal = (oneTime?.amountCents ?? 0) + addOnOneTimeCents;
        // Period-normalized monthly fee via the shared util (RSL-29 — the RSL-18 dashboard fix's
        // single source of truth), so a quarterly/annual retainer or recurring add-on is never
        // dropped to $0 in the CRM record.
        const monthlyTotal = monthlyRecurringCents(recurring, selectedAddOns);
        const { pageId } = await updateCrmOnPaid({
          company: tokens["Client.Company"],
          monthlyFeeCents: monthlyTotal > 0 ? monthlyTotal : null,
          oneTimeFeeCents: oneTimeTotal > 0 ? oneTimeTotal : null,
          proposalUrl,
          signedPdfUrl: proposal.documents[0]?.blobUrl ?? null,
          stripeCustomerId: proposal.stripeCustomerId,
        });
        await logEvent({ proposalId, eventType: "NOTION_SYNCED", metadata: { kind: "paid" } });
        if (pageId) {
          await prisma.proposal.update({ where: { id: proposalId }, data: { notionPageId: pageId } });
        }
      }
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
  // Recover jobs stranded in PROCESSING by a killed lambda before claiming new work (RSL-13).
  await reapStuckJobs();
  const jobs = await claimJobs(limit);
  let failed = 0;
  for (const job of jobs) {
    try {
      await executeJob(job);
      await completeJob(job.id);
    } catch (error) {
      failed++;
      // One job's bookkeeping failure must never abort the rest of the batch (RSL-13):
      // failJob's own prisma.update can reject on a DB hiccup — isolate it.
      try {
        await failJob(job, error);
      } catch (failError) {
        console.error("failJob threw while recording a job failure", job.id, failError);
      }
    }
  }
  return { ran: jobs.length, failed };
}

/** Runs one specific job immediately if it's still pending (race-safe with the cron). */
export async function runJobNow(jobId: string): Promise<void> {
  // Match claimJobs' due-gate: never run a job before its scheduledAt backoff has elapsed,
  // or an opportunistic immediate run would defeat failJob's exponential backoff (RSL-13).
  const claimed = await prisma.$queryRaw<PendingJob[]>`
    UPDATE "proposals"."PendingJob"
    SET "status" = 'PROCESSING', "processingAt" = NOW(), "attempts" = "attempts" + 1, "updatedAt" = NOW()
    WHERE "id" = ${jobId} AND "status" = 'PENDING' AND "scheduledAt" <= NOW()
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
