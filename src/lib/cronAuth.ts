import { prisma } from "@/lib/prisma";
import { shouldWriteCronLog } from "@/lib/cronLogPolicy";

export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function logCronRun(
  path: string,
  startedAt: number,
  ok: boolean,
  note?: string,
  opts?: { noop?: boolean }
): Promise<void> {
  try {
    // Quiet runs collapse to one heartbeat row per day (cronLogPolicy) — the
    // read below is served from cache and uses CronLog_path_ranAt_idx; the
    // per-run INSERTs were what chewed the shared Nano's Disk IO budget.
    if (ok && opts?.noop) {
      const last = await prisma.cronLog.findFirst({
        where: { path },
        orderBy: { ranAt: "desc" },
        select: { ranAt: true, ok: true },
      });
      if (!shouldWriteCronLog({ ok, noop: true, last, now: new Date() })) return;
      note = note ? `${note} (heartbeat)` : "heartbeat";
    }
    await prisma.cronLog.create({
      data: { path, durationMs: Date.now() - startedAt, ok, note },
    });
  } catch (error) {
    console.error("cron log write failed", error);
  }

  // A crashed cron is invisible until someone opens the dashboard — surface it
  // by email instead. Deduped per cron per hour so a flapping run can't spam.
  if (!ok) {
    const { sendSystemAlert } = await import("@/lib/email");
    const hourBucket = new Date().toISOString().slice(0, 13);
    await sendSystemAlert({
      summary: `Cron run failed: ${path}`,
      details: [
        { label: "Cron", value: path },
        { label: "Error", value: (note ?? "unknown").slice(0, 300) },
      ],
      dedupeKey: `cron-${path}-${hourBucket}`,
    });
  }
}
