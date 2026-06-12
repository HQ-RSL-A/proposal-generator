import { describe, expect, it } from "vitest";
import { isExpired, parseValidUntil } from "@/lib/dates";

describe("parseValidUntil", () => {
  it("parses the skill's date format to end-of-day Eastern", () => {
    const result = parseValidUntil("July 11, 2026");
    expect(result).not.toBeNull();
    // 23:59:59 EDT = 03:59:59 UTC next day
    expect(result!.toISOString()).toBe("2026-07-12T03:59:59.000Z");
  });
  it("uses EST offset in winter", () => {
    const result = parseValidUntil("January 15, 2026");
    expect(result!.toISOString()).toBe("2026-01-16T04:59:59.000Z");
  });
  it("returns null for garbage", () => {
    expect(parseValidUntil("not a date")).toBeNull();
  });
});

describe("isExpired", () => {
  it("treats null as never expiring", () => {
    expect(isExpired(null)).toBe(false);
  });
  it("compares against now", () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isExpired(new Date(Date.now() + 100_000))).toBe(false);
  });
});
