import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findCrmPage } from "./notion";

/** A Notion page row as the query/search endpoints return it. */
function page(id: string, title: string) {
  return { id, properties: { Company: { title: [{ plain_text: title }] } } };
}

function mockNotion(opts: { schema: unknown; query?: unknown; search?: unknown }) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    let body: unknown = { results: [] };
    if (u.endsWith("/query")) body = opts.query;
    else if (u.includes("/databases/")) body = opts.schema;
    else if (u.endsWith("/search")) body = opts.search ?? { results: [] };
    return { ok: true, json: async () => body, text: async () => "" } as Response;
  });
}

const titleSchema = { properties: { Company: { type: "title" } } };

beforeEach(() => {
  process.env.NOTION_API_KEY = "test-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("findCrmPage (RSL-15 exact-match company)", () => {
  it("returns the exact-title page, not a substring sibling that sorts first", async () => {
    // "Scorpion Logistics" substring-matches the demo row, which Notion sorts first.
    vi.stubGlobal(
      "fetch",
      mockNotion({
        schema: titleSchema,
        query: {
          results: [
            page("demo", "Scorpion Logistics (DEMO)"),
            page("real", "Scorpion Logistics"),
          ],
        },
      })
    );

    expect(await findCrmPage("Scorpion Logistics")).toBe("real");
  });

  it("refuses (throws) rather than guessing when two pages share the exact title", async () => {
    vi.stubGlobal(
      "fetch",
      mockNotion({
        schema: titleSchema,
        query: { results: [page("a", "Acme"), page("b", "Acme")] },
      })
    );

    await expect(findCrmPage("Acme")).rejects.toThrow(/refus/i);
  });

  it("returns null when no row matches exactly (does not PATCH a near-miss)", async () => {
    vi.stubGlobal(
      "fetch",
      mockNotion({
        schema: titleSchema,
        query: { results: [page("demo", "Scorpion (DEMO)"), page("log", "Scorpion Logistics")] },
        search: { results: [] },
      })
    );

    expect(await findCrmPage("Scorpion")).toBeNull();
  });
});
