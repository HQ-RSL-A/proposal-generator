import { describe, expect, it } from "vitest";
import { generateSigningToken, hashToken, isWellFormedToken } from "@/lib/tokens";

describe("signing tokens", () => {
  it("generates 64-char hex tokens with matching hash", () => {
    const { raw, hash } = generateSigningToken();
    expect(isWellFormedToken(raw)).toBe(true);
    expect(hash).toBe(hashToken(raw));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(raw);
  });
  it("generates unique tokens", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateSigningToken().raw));
    expect(seen.size).toBe(50);
  });
  it("rejects malformed tokens", () => {
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("Z".repeat(64))).toBe(false);
    expect(isWellFormedToken("a".repeat(63))).toBe(false);
  });
});
