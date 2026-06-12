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
}
