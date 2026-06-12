import { describe, expect, it } from "vitest";
import { computeContentHash, stableStringify } from "@/lib/contentHash";

describe("stableStringify", () => {
  it("sorts object keys recursively", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });
  it("preserves array order", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });
  it("drops undefined values", () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

describe("computeContentHash", () => {
  it("is order-independent for objects", () => {
    const a = computeContentHash({ x: 1, y: { z: "hello", w: [1, 2] } });
    const b = computeContentHash({ y: { w: [1, 2], z: "hello" }, x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes when content changes", () => {
    expect(computeContentHash({ amount: 100 })).not.toBe(computeContentHash({ amount: 101 }));
  });
});
