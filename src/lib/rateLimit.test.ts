import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fresh module (and thus a fresh in-memory store) per test, with fake timers so
// window/eviction behavior is deterministic.
describe("checkRateLimit", () => {
  let checkRateLimit: typeof import("@/lib/rateLimit").checkRateLimit;
  let rateLimitSize: typeof import("@/lib/rateLimit").rateLimitSize;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const mod = await import("@/lib/rateLimit");
    checkRateLimit = mod.checkRateLimit;
    rateLimitSize = mod.rateLimitSize;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("evicts expired entries instead of growing unbounded", () => {
    const windowMs = 60_000;
    // Many distinct keys (e.g. spoofed x-forwarded-for values) in one window.
    for (let i = 0; i < 500; i++) checkRateLimit(`k${i}`, 10, windowMs);
    expect(rateLimitSize()).toBe(500);

    // After the window elapses, every entry is stale; the next call sweeps them.
    vi.setSystemTime(windowMs + 1);
    checkRateLimit("trigger", 10, windowMs);
    expect(rateLimitSize()).toBe(1);
  });

  it("allows requests up to the limit, then blocks within the window", () => {
    expect(checkRateLimit("ip", 3, 60_000)).toBe(true);
    expect(checkRateLimit("ip", 3, 60_000)).toBe(true);
    expect(checkRateLimit("ip", 3, 60_000)).toBe(true);
    expect(checkRateLimit("ip", 3, 60_000)).toBe(false);
  });

  it("resets the count after the window elapses", () => {
    expect(checkRateLimit("ip", 1, 60_000)).toBe(true);
    expect(checkRateLimit("ip", 1, 60_000)).toBe(false);
    vi.setSystemTime(60_001);
    expect(checkRateLimit("ip", 1, 60_000)).toBe(true);
  });
});
