import { prisma } from "@/lib/prisma";
import type { JobType, PendingJob, Prisma } from "@/generated/prisma/client";

/**
 * Minimal background-retry queue: a Postgres table drained by a cron.
 * Immediate execution happens via after() at the call site; the queue is the
 * safety net when that (or the external API) fails.
 */
export async function enqueueJob(input: {
  jobType: JobType;
  payload: Record<string, unknown>;
  proposalId?: string | null;
  scheduledAt?: Date;
}): Promise<PendingJob> {
  return prisma.pendingJob.create({
    data: {
      jobType: input.jobType,
      payload: input.payload as Prisma.InputJsonValue,
      proposalId: input.proposalId ?? null,
      scheduledAt: input.scheduledAt ?? new Date(),
    },
  });
}

/** Atomically claim up to `limit` due jobs. SKIP LOCKED prevents double-claiming across cron runs. */
export async function claimJobs(limit = 10): Promise<PendingJob[]> {
  return prisma.$queryRaw<PendingJob[]>`
    UPDATE "proposals"."PendingJob"
    SET "status" = 'PROCESSING', "processingAt" = NOW(), "attempts" = "attempts" + 1, "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "proposals"."PendingJob"
      WHERE "status" = 'PENDING' AND "scheduledAt" <= NOW()
      ORDER BY "scheduledAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

export async function completeJob(jobId: string): Promise<void> {
  await prisma.pendingJob.update({
    where: { id: jobId },
    data: { status: "DONE", completedAt: new Date(), lastError: null },
  });
}

export async function failJob(job: PendingJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? `${error.message}` : String(error);
  const dead = job.attempts >= job.maxAttempts;
  // Exponential backoff: 2^attempts * 30s, capped at 1 hour.
  const delayMs = Math.min(2 ** job.attempts * 30_000, 3_600_000);
  await prisma.pendingJob.update({
    where: { id: job.id },
    data: dead
      ? { status: "DEAD", lastError: message.slice(0, 2000) }
      : {
          status: "PENDING",
          lastError: message.slice(0, 2000),
          scheduledAt: new Date(Date.now() + delayMs),
        },
  });

  // A job that exhausted its retries needs a human. Alert immediately instead
  // of waiting for someone to open the dashboard. Dynamic import avoids a
  // module cycle (email.tsx enqueues jobs through this file).
  if (dead) {
    const { sendSystemAlert } = await import("@/lib/email");
    await sendSystemAlert({
      summary: `A ${job.jobType} background task failed permanently`,
      details: [
        { label: "Task", value: job.jobType },
        { label: "Attempts", value: `${job.attempts} of ${job.maxAttempts}` },
        { label: "Error", value: message.slice(0, 300) },
        ...(job.proposalId ? [{ label: "Proposal", value: job.proposalId }] : []),
      ],
      dedupeKey: `job-${job.id}-dead`,
      proposalId: job.proposalId ?? undefined,
    });
  }
}

/**
 * Requeue jobs stranded in PROCESSING past a timeout. `claimJobs` flips a row to PROCESSING,
 * and a lambda killed mid-batch (maxDuration=60s) — or a batch that aborted before `failJob`
 * ran — leaves it there forever, since nothing else moves PROCESSING back to PENDING. Run at
 * the top of each sweep. The timeout sits well above the 60s lambda ceiling so a job that is
 * genuinely still running is never reaped out from under itself (RSL-13).
 */
export async function reapStuckJobs(timeoutMs = 5 * 60_000): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMs);
  const { count } = await prisma.pendingJob.updateMany({
    where: { status: "PROCESSING", processingAt: { lt: cutoff } },
    data: { status: "PENDING" },
  });
  return count;
}

/** Reset a DEAD job for manual retry from the dashboard. */
export async function retryDeadJob(jobId: string): Promise<void> {
  await prisma.pendingJob.update({
    where: { id: jobId },
    data: { status: "PENDING", attempts: 0, scheduledAt: new Date() },
  });
}
