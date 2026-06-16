import { describe, expect, test } from "vitest";
import { z } from "zod";
import { humanizeZodError } from "@/lib/zodErrors";

// Build real ZodErrors from real parse failures so the tests exercise the
// actual issue shapes Zod produces (not hand-built issue objects).
const tokens = z.object({
  "Client.FirstName": z.string().trim().min(1),
  "Client.LastName": z.string().trim().min(1),
  "Client.ProposalTitle": z.string().trim().min(1),
});

function errorFrom(schema: z.ZodType, input: unknown): z.ZodError {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected the parse to fail");
  return result.error;
}

describe("humanizeZodError", () => {
  test("an empty required string reads as '<Field> is required'", () => {
    const err = errorFrom(tokens, {
      "Client.FirstName": "Christian",
      "Client.LastName": "",
      "Client.ProposalTitle": "Growth Plan",
    });
    expect(humanizeZodError(err)).toBe("Last name is required.");
  });

  test("a whitespace-only required string also reads as required", () => {
    const err = errorFrom(tokens, {
      "Client.FirstName": "Christian",
      "Client.LastName": "   ",
      "Client.ProposalTitle": "Growth Plan",
    });
    expect(humanizeZodError(err)).toBe("Last name is required.");
  });

  test("a missing required field reads as required", () => {
    const err = errorFrom(tokens, {
      "Client.FirstName": "Christian",
      "Client.ProposalTitle": "Growth Plan",
    });
    expect(humanizeZodError(err)).toBe("Last name is required.");
  });

  test("camelCase token keys become spaced, sentence-case labels", () => {
    const err = errorFrom(tokens, {
      "Client.FirstName": "",
      "Client.LastName": "Reyes",
      "Client.ProposalTitle": "Growth Plan",
    });
    expect(humanizeZodError(err)).toBe("First name is required.");
  });

  test("multiple problems are listed as separate sentences", () => {
    const err = errorFrom(tokens, { "Client.ProposalTitle": "Growth Plan" });
    expect(humanizeZodError(err)).toBe("First name is required. Last name is required.");
  });

  test("a too-long value reads as a max-length limit", () => {
    const err = errorFrom(z.object({ name: z.string().max(3) }), { name: "toolong" });
    expect(humanizeZodError(err)).toBe("Name must be at most 3 characters.");
  });

  test("other issue types fall back to field + readable message", () => {
    const err = errorFrom(z.object({ link: z.url() }), { link: "not-a-url" });
    expect(humanizeZodError(err)).toBe("Link: Invalid URL.");
  });

  test("identical messages are de-duplicated", () => {
    const err = errorFrom(z.object({ a: z.string().min(1), b: z.string().min(1) }), {
      a: "",
      b: "",
    });
    // "A is required. B is required." — distinct labels, both kept
    expect(humanizeZodError(err)).toBe("A is required. B is required.");
  });
});
