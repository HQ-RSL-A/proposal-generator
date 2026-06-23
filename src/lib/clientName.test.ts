import { describe, expect, test } from "vitest";
import { clientFullName, collapseNameFieldGap } from "@/lib/clientName";

describe("clientFullName", () => {
  test("joins first and last when both are present", () => {
    expect(clientFullName("Christian", "Reyes")).toBe("Christian Reyes");
  });
  test("returns just the first name when the last name is blank", () => {
    expect(clientFullName("Christian", "")).toBe("Christian");
  });
  test("ignores a whitespace-only last name", () => {
    expect(clientFullName("Christian", "   ")).toBe("Christian");
  });
  test("trims surrounding whitespace on both parts", () => {
    expect(clientFullName("  Christian ", " Reyes ")).toBe("Christian Reyes");
  });
  test("tolerates an undefined last name without throwing", () => {
    expect(clientFullName("Christian", undefined as unknown as string)).toBe("Christian");
  });
});

describe("collapseNameFieldGap", () => {
  test("removes the space a blank surname leaves before a comma", () => {
    expect(collapseNameFieldGap("Christian , Valley Oak Landscape Co")).toBe(
      "Christian, Valley Oak Landscape Co"
    );
  });
  test("leaves a normal name line untouched", () => {
    expect(collapseNameFieldGap("Christian Reyes, Valley Oak Landscape Co")).toBe(
      "Christian Reyes, Valley Oak Landscape Co"
    );
  });
  test("collapses a double space left by an empty field", () => {
    expect(collapseNameFieldGap("Christian  Co")).toBe("Christian Co");
  });
});
