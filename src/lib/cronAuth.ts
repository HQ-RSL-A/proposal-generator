import { prisma } from "@/lib/prisma";

export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function logCronRun(
  path: string,
  startedAt: number,
  ok: boolean,
  note?: string
): Promise<void> {
  try {
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
