import { parseCentsFromDisplayString } from "@/lib/currency";

/** The discount-aware fields of a single money draft in the proposal form. */
export interface MoneyDraftLike {
  displayString: string;
  /** Always the NET (post-discount) amount in cents. */
  amountCents: number;
  discountEnabled?: boolean;
  discountCents?: number;
  discountReason?: string;
}

export interface MoneyDraftIssues {
  /** Display string does not match the charged net (only checked when no discount is on). */
  mismatch: boolean;
  /** The discount is the whole list price or more, so the net is zero or negative. */
  netTooLow: boolean;
  /** A discount is enabled but its (client-visible) reason is blank. */
  reasonMissing: boolean;
}

/**
 * Single source of truth for the form's per-line money advisories. MoneyFields renders each flag
 * inline; handleSave gates the save on any of them so a known-bad line never makes a server round
 * trip (RSL-38). amountCents is the net; the list price is net + discount.
 */
export function moneyDraftIssues(value: MoneyDraftLike, withDiscount: boolean): MoneyDraftIssues {
  const discountOn = Boolean(withDiscount && value.discountEnabled);
  const discountCents = value.discountCents ?? 0;
  const listCents = value.amountCents + discountCents;
  const parsed = parseCentsFromDisplayString(value.displayString);
  return {
    mismatch: !discountOn && parsed !== null && Math.abs(parsed - value.amountCents) > 1,
    netTooLow: discountOn && discountCents > 0 && discountCents >= listCents,
    reasonMissing: discountOn && (value.discountReason ?? "").trim().length === 0,
  };
}

export function hasMoneyDraftIssue(value: MoneyDraftLike, withDiscount: boolean): boolean {
  const issues = moneyDraftIssues(value, withDiscount);
  return issues.mismatch || issues.netTooLow || issues.reasonMissing;
}
