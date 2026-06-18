// validUntil semantics: the proposal is valid through the END of the stated day
// in America/New_York (RSL/A's home timezone) — every US client gets the full day.

/**
 * The UTC offset for America/New_York on a given calendar day, as a "±HH:MM"
 * string, derived from the IANA tz database via Intl — correct across DST
 * transitions (no hand-rolled month band). Sampled at noon UTC, which is safely
 * past the 02:00 local DST switch on either edge day, so it matches the
 * end-of-day offset that parseValidUntil needs.
 */
function easternOffset(y: number, m: number, d: number): string {
  const sample = new Date(Date.UTC(y, m, d, 12, 0, 0));
  const tzName =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "longOffset",
    })
      .formatToParts(sample)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-05:00";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return "-05:00";
  const [, sign, hh, mm = "00"] = match;
  return `${sign}${hh.padStart(2, "0")}:${mm}`;
}

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
  const offset = easternOffset(y, m, d);
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
