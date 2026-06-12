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
}

/** Reset a DEAD job for manual retry from the dashboard. */
export async function retryDeadJob(jobId: string): Promise<void> {
  await prisma.pendingJob.update({
    where: { id: jobId },
    data: { status: "PENDING", attempts: 0, scheduledAt: new Date() },
  });
}
