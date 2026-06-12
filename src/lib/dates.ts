// validUntil semantics: the proposal is valid through the END of the stated day
// in America/New_York (RSL/A's home timezone) — every US client gets the full day.

const EASTERN_OFFSETS = ["-04:00", "-05:00"] as const;

/**
 * Parses a human date like "July 11, 2026" (the skill's Client.ValidUntil format)
 * to a UTC Date representing 23:59:59 Eastern on that day. Returns null if unparseable.
 */
export function parseValidUntil(display: string): Date | null {
  const parsed = new Date(display);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = parsed.getMonth();
  const d = parsed.getDate();
  // DST guess: April–October = EDT (-04:00). Off-by-an-hour at the edges is acceptable
  // for a proposal validity deadline.
  const offset = m >= 3 && m <= 9 ? EASTERN_OFFSETS[0] : EASTERN_OFFSETS[1];
  const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T23:59:59${offset}`;
  const result = new Date(iso);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function isExpired(validUntil: Date | null): boolean {
  if (!validUntil) return false;
  return validUntil.getTime() < Date.now();
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
