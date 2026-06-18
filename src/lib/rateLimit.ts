const requests = new Map<string, { count: number; resetAt: number }>();

// Throttle the O(n) sweep so it runs at most once per window rather than on
// every request.
let nextSweepAt = 0;

function evictExpired(now: number): void {
  for (const [key, entry] of requests) {
    if (now > entry.resetAt) requests.delete(key);
  }
}

/**
 * Per-instance, in-memory rate limiter (abuse-dampening / cost control).
 *
 * DELIBERATELY per-lambda-instance, NOT a shared store: the 256-bit signing
 * token is the real authorization boundary (see CLAUDE.md), so this throttles
 * abuse and cost, it does not gate access. Consequences accepted:
 *  - Cross-instance fan-out can grant up to N× the nominal limit (N = warm
 *    instances). Fine, because the token — not the rate limit — is what stops
 *    an attacker.
 *  - The key embeds an attacker-spoofable x-forwarded-for, so distinct/forged
 *    keys would otherwise grow the Map unbounded for the instance lifetime;
 *    `evictExpired` bounds it to roughly the keys seen within one window.
 *
 * If true cross-instance limits are ever needed, swap the Map for a shared
 * store (Upstash/Redis) with native TTL — the call sites don't change.
 */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  if (now >= nextSweepAt) {
    evictExpired(now);
    nextSweepAt = now + windowMs;
  }
  const entry = requests.get(key);
  if (!entry || now > entry.resetAt) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/** Number of currently tracked keys — for tests and ops introspection. */
export function rateLimitSize(): number {
  return requests.size;
}
