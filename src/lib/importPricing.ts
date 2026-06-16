import { parseCentsFromDisplayString } from "@/lib/currency";
import type { OneTimeItem, RecurringItem } from "@/lib/types";

/** Normalized flat pricing pulled out of a pasted tokens JSON, ready to merge into the form. */
export interface FlatPricingImport {
  oneTime: OneTimeItem | null;
  recurring: RecurringItem | null;
  /** Card / ACH toggles, or null when the source didn't specify payment methods. */
  methods: { card: boolean; ach: boolean } | null;
  /** Prefer-ACH flag, or null when the source didn't specify it. */
  preferAch: boolean | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Trust a positive-integer amountCents; otherwise derive cents from the display string. */
function resolveCents(amountCents: unknown, displayString: string): number | null {
  if (typeof amountCents === "number" && Number.isInteger(amountCents) && amountCents > 0) {
    return amountCents;
  }
  const parsed = parseCentsFromDisplayString(displayString);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function readMoney(
  value: unknown,
  defaultLabel: string
): { label: string; displayString: string; amountCents: number } | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const displayString = typeof obj.displayString === "string" ? obj.displayString.trim() : "";
  const amountCents = resolveCents(obj.amountCents, displayString);
  if (amountCents === null) return null;
  const label =
    typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : defaultLabel;
  return { label, displayString, amountCents };
}

function readInterval(value: unknown): 1 | 3 | 12 {
  return value === 1 || value === 3 || value === 12 ? value : 1;
}

/**
 * Pulls flat (non-tiered) pricing out of a pasted tokens JSON written in the platform's internal
 * `PaymentConfig` shape (top-level `oneTime` / `recurring` / `paymentMethods` / `preferAch`). The
 * import box has no structured block for flat pricing, so without this a flat deal pastes with the
 * copy filled but the amounts blank. Returns null when the deal is tiered (tiers win) or carries no
 * flat amounts, so it never clobbers an otherwise-empty pricing section.
 */
export function inferFlatPricingFromImport(
  raw: Record<string, unknown>
): FlatPricingImport | null {
  // Flat and tiers are mutually exclusive; a tiers array (handled via Investment.Structure) wins.
  if (Array.isArray(raw.tiers) && raw.tiers.length > 0) return null;

  const oneTime: OneTimeItem | null = readMoney(raw.oneTime, "One-time build");

  const recurringMoney = readMoney(raw.recurring, "Monthly retainer");
  const recurring: RecurringItem | null = recurringMoney
    ? { ...recurringMoney, intervalMonths: readInterval(asRecord(raw.recurring)?.intervalMonths) }
    : null;

  if (!oneTime && !recurring) return null;

  const methods = Array.isArray(raw.paymentMethods)
    ? {
        card: raw.paymentMethods.includes("card"),
        ach: raw.paymentMethods.includes("us_bank_account"),
      }
    : null;

  const preferAch = typeof raw.preferAch === "boolean" ? raw.preferAch : null;

  return { oneTime, recurring, methods, preferAch };
}
