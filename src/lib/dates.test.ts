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
  it("uses EDT after spring-forward in March (DST starts mid-March)", () => {
    // 2026 DST starts Mar 8, so Mar 9-31 are EDT (-04:00), not EST.
    // The old month-band treated all of March as EST -> an hour late.
    const result = parseValidUntil("March 20, 2026");
    expect(result!.toISOString()).toBe("2026-03-21T03:59:59.000Z");
  });
  it("uses EDT on the spring-forward day itself", () => {
    // Mar 8, 2026: 02:00 EST -> 03:00 EDT; end of that day is EDT.
    const result = parseValidUntil("March 8, 2026");
    expect(result!.toISOString()).toBe("2026-03-09T03:59:59.000Z");
  });
  it("uses EDT in early November before DST ends", () => {
    // 2027 DST ends Nov 7, so Nov 5 is still EDT (-04:00), not EST.
    const result = parseValidUntil("November 5, 2027");
    expect(result!.toISOString()).toBe("2027-11-06T03:59:59.000Z");
  });
  it("uses EST on the fall-back day", () => {
    // Nov 1, 2026: 02:00 EDT -> 01:00 EST; end of that day is EST.
    const result = parseValidUntil("November 1, 2026");
    expect(result!.toISOString()).toBe("2026-11-02T04:59:59.000Z");
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
