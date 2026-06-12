// All money is integer cents. Division by 100 happens only at display time.

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * Parses a human display string like "$3,000/month", "$997", "$1,149.50 / mo"
 * into integer cents. Returns null when no dollar amount can be found.
 */
export function parseCentsFromDisplayString(display: string): number | null {
  const match = display.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const numeric = match[1].replace(/,/g, "");
  const value = Number.parseFloat(numeric);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Display string and structured cents must agree before a proposal can be sent. */
export function displayMatchesCents(display: string, cents: number): boolean {
  const parsed = parseCentsFromDisplayString(display);
  if (parsed === null) return false;
  return Math.abs(parsed - cents) <= 1;
}

export function intervalLabel(intervalMonths: 1 | 3 | 12): string {
  switch (intervalMonths) {
    case 1:
      return "month";
    case 3:
      return "quarter";
    case 12:
      return "year";
  }
}
