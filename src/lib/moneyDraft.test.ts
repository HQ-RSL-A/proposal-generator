import { describe, expect, it } from "vitest";
import { moneyDraftIssues, hasMoneyDraftIssue } from "@/lib/moneyDraft";

describe("moneyDraftIssues", () => {
  it("flags a display/charged mismatch only when no discount is on", () => {
    expect(moneyDraftIssues({ displayString: "$1,000", amountCents: 90000 }, false).mismatch).toBe(true);
    // With a discount on, the display tracks the net, so mismatch is suppressed.
    const discounted = { displayString: "$750", amountCents: 75000, discountEnabled: true, discountCents: 25000, discountReason: "x" };
    expect(moneyDraftIssues(discounted, true).mismatch).toBe(false);
  });

  it("flags net-too-low when the discount is the whole price or more", () => {
    const value = { displayString: "$0", amountCents: 0, discountEnabled: true, discountCents: 100000, discountReason: "x" };
    expect(moneyDraftIssues(value, true).netTooLow).toBe(true);
  });

  it("flags a blank reason when a discount is enabled", () => {
    const value = { displayString: "$750", amountCents: 75000, discountEnabled: true, discountCents: 25000, discountReason: "  " };
    expect(moneyDraftIssues(value, true).reasonMissing).toBe(true);
  });

  it("is clean for a well-formed discounted line", () => {
    const value = { displayString: "$750", amountCents: 75000, discountEnabled: true, discountCents: 25000, discountReason: "Loyalty" };
    expect(hasMoneyDraftIssue(value, true)).toBe(false);
  });

  it("ignores discount fields when withDiscount is false", () => {
    const value = { displayString: "$1,000", amountCents: 100000, discountEnabled: true, discountCents: 100000, discountReason: "" };
    expect(hasMoneyDraftIssue(value, false)).toBe(false);
  });
});
