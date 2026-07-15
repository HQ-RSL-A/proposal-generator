import { describe, expect, it } from "vitest";
import { CRON_HEARTBEAT_MS, shouldWriteCronLog } from "@/lib/cronLogPolicy";

// CronLog volume is a real cost on the shared Nano database (2026-07 Disk IO
// Budget warning): a */5 cron logging every quiet run wrote ~288 rows/day and
// ~98 MB of WAL. The policy keeps the log meaningful while silencing no-ops.
describe("shouldWriteCronLog", () => {
  const now = new Date("2026-07-15T12:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it("always writes failures, even right after a fresh row", () => {
    expect(
      shouldWriteCronLog({ ok: false, noop: true, last: { ranAt: minutesAgo(1), ok: true }, now })
    ).toBe(true);
  });

  it("always writes runs that did work", () => {
    expect(
      shouldWriteCronLog({ ok: true, noop: false, last: { ranAt: minutesAgo(1), ok: true }, now })
    ).toBe(true);
  });

  it("writes the first row for a path (no history)", () => {
    expect(shouldWriteCronLog({ ok: true, noop: true, last: null, now })).toBe(true);
  });

  it("writes a no-op success when the last row was a failure, so recovery is visible", () => {
    expect(
      shouldWriteCronLog({ ok: true, noop: true, last: { ranAt: minutesAgo(5), ok: false }, now })
    ).toBe(true);
  });

  it("suppresses a no-op success within the heartbeat window", () => {
    expect(
      shouldWriteCronLog({ ok: true, noop: true, last: { ranAt: minutesAgo(5), ok: true }, now })
    ).toBe(false);
  });

  it("writes a daily heartbeat once the window has fully elapsed", () => {
    const staleOk = { ranAt: new Date(now.getTime() - CRON_HEARTBEAT_MS - 1), ok: true };
    expect(shouldWriteCronLog({ ok: true, noop: true, last: staleOk, now })).toBe(true);
  });

  it("writes at exactly the heartbeat boundary", () => {
    const boundary = { ranAt: new Date(now.getTime() - CRON_HEARTBEAT_MS), ok: true };
    expect(shouldWriteCronLog({ ok: true, noop: true, last: boundary, now })).toBe(true);
  });
});
