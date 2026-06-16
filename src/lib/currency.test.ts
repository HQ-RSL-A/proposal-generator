import { describe, expect, it } from "vitest";
import {
  displayMatchesCents,
  formatCents,
  formatPricedLine,
  parseCentsFromDisplayString,
} from "@/lib/currency";

describe("parseCentsFromDisplayString", () => {
  it("parses plain amounts", () => {
    expect(parseCentsFromDisplayString("$997")).toBe(99700);
    expect(parseCentsFromDisplayString("$1,997")).toBe(199700);
    expect(parseCentsFromDisplayString("$26,000")).toBe(2600000);
  });
  it("parses recurring display strings", () => {
    expect(parseCentsFromDisplayString("$3,000/month")).toBe(300000);
    expect(parseCentsFromDisplayString("$497/mo")).toBe(49700);
    expect(parseCentsFromDisplayString("$1,149.50 / month")).toBe(114950);
  });
  it("handles missing dollar sign and decimals", () => {
    expect(parseCentsFromDisplayString("4500 per month")).toBe(450000);
    expect(parseCentsFromDisplayString("$0.99")).toBe(99);
  });
  it("returns null when no amount exists", () => {
    expect(parseCentsFromDisplayString("free")).toBeNull();
    expect(parseCentsFromDisplayString("")).toBeNull();
  });
});

describe("displayMatchesCents", () => {
  it("accepts matching values", () => {
    expect(displayMatchesCents("$3,000/month", 300000)).toBe(true);
  });
  it("rejects mismatches", () => {
    expect(displayMatchesCents("$3,000/month", 299900)).toBe(false);
  });
  it("tolerates a one-cent rounding gap", () => {
    expect(displayMatchesCents("$10.005", 1001)).toBe(true);
  });
});

describe("formatCents", () => {
  it("drops cents for whole dollars", () => {
    expect(formatCents(300000)).toBe("$3,000");
  });
  it("keeps cents when present", () => {
    expect(formatCents(114950)).toBe("$1,149.50");
  });
});

describe("formatPricedLine", () => {
  it("formats a one-time amount as plain currency", () => {
    expect(formatPricedLine(300000, null)).toBe("$3,000");
  });
  it("appends the cadence for recurring amounts", () => {
    expect(formatPricedLine(125000, 1)).toBe("$1,250/month");
    expect(formatPricedLine(90000, 3)).toBe("$900/quarter");
    expect(formatPricedLine(300000, 12)).toBe("$3,000/year");
  });
  it("keeps cents when present", () => {
    expect(formatPricedLine(114950, 1)).toBe("$1,149.50/month");
  });
});
