import { describe, expect, it } from "vitest";
import { LEGACY_TRACK_RECORD, resolveTrackRecord } from "@/lib/trackRecord";

describe("resolveTrackRecord — validate frozen content on read (RSL-21)", () => {
  it("returns the legacy default for null/undefined", () => {
    expect(resolveTrackRecord(null)).toBe(LEGACY_TRACK_RECORD);
    expect(resolveTrackRecord(undefined)).toBe(LEGACY_TRACK_RECORD);
  });

  it("passes through a well-formed config", () => {
    const cfg = { intro: "We build things", caseStudies: [{ text: "a win", href: "" }] };
    expect(resolveTrackRecord(cfg)).toEqual(cfg);
  });

  it("falls back to legacy for a malformed value instead of crashing the render", () => {
    // Each of these used to reach `trackRecord.caseStudies.length` and throw.
    expect(resolveTrackRecord({ intro: "no case studies key" })).toBe(LEGACY_TRACK_RECORD);
    expect(resolveTrackRecord({ intro: "bad", caseStudies: "not-an-array" })).toBe(
      LEGACY_TRACK_RECORD
    );
    expect(resolveTrackRecord(42)).toBe(LEGACY_TRACK_RECORD);
  });
});
