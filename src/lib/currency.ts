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

/**
 * Currency for a priced line, derived from cents (the validated source of truth) so the display is
 * always formatted regardless of how the display string was typed. Appends the cadence when recurring.
 */
export function formatPricedLine(amountCents: number, intervalMonths: 1 | 3 | 12 | null): string {
  const base = formatCents(amountCents);
  return intervalMonths ? `${base}/${intervalLabel(intervalMonths)}` : base;
}

/** Minimal shape of a priced line for discount math (net amountCents + optional discount). */
type DiscountableLine = {
  amountCents: number;
  discount?: { amountCents: number; reason: string } | null;
};

/** True when a line carries a usable (positive) discount. */
export function hasDiscount(item: DiscountableLine): boolean {
  return !!item.discount && item.discount.amountCents > 0;
}

/**
 * The pre-discount (original) price in cents: the net amountCents plus any discount. The line's
 * amountCents is always the net actually charged, so the original is derived, never stored.
 */
export function originalCents(item: DiscountableLine): number {
  return item.amountCents + (item.discount?.amountCents ?? 0);
}

/** The formatted pieces of a "was {original} -> now {net} ({reason})" treatment, or null. */
export interface DiscountDisplay {
  /** Formatted original price (with cadence when recurring), e.g. "$10,000/month". */
  originalLabel: string;
  /** Formatted net price actually charged, e.g. "$9,000/month". */
  netLabel: string;
  /** Formatted savings, e.g. "$1,000 off". */
  savedLabel: string;
  /** What the discount is for. */
  reason: string;
}

/**
 * Shared discount-display math for a priced line. Returns null when there's no positive discount.
 * Web and PDF each render these strings with their own strike-through styling so they stay identical.
 */
export function discountDisplay(
  item: DiscountableLine,
  intervalMonths: 1 | 3 | 12 | null
): DiscountDisplay | null {
  if (!hasDiscount(item)) return null;
  return {
    originalLabel: formatPricedLine(originalCents(item), intervalMonths),
    netLabel: formatPricedLine(item.amountCents, intervalMonths),
    savedLabel: `${formatCents(item.discount!.amountCents)} off`,
    reason: item.discount!.reason,
  };
}
