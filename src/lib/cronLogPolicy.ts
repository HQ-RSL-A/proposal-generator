/**
 * Write policy for CronLog rows. The database is a shared free-tier Nano
 * instance (also hosts expenseVault), and logging every quiet 5-minute run wrote
 * ~288 rows/day / ~98 MB of WAL — enough to trip Supabase's Disk IO Budget
 * warning (2026-07). Failures and real work always log; quiet runs collapse
 * to one heartbeat per day, and the first success after a failure always
 * logs so the Settings health panel shows recovery instead of a stale
 * "failed" badge.
 */
export const CRON_HEARTBEAT_MS = 24 * 60 * 60 * 1000;

export function shouldWriteCronLog(run: {
  ok: boolean;
  /** True when the run did no observable work (nothing ran, failed, healed, expired). */
  noop: boolean;
  /** Most recent CronLog row for this path, if any. */
  last: { ranAt: Date; ok: boolean } | null;
  now: Date;
}): boolean {
  if (!run.ok) return true;
  if (!run.noop) return true;
  if (!run.last) return true;
  if (!run.last.ok) return true;
  return run.now.getTime() - run.last.ranAt.getTime() >= CRON_HEARTBEAT_MS;
}
