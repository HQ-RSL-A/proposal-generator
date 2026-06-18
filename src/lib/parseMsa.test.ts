import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  findUnreplacedTokens,
  parseMsa,
  parseRuns,
  replaceTokens,
  replaceTokensInBlocks,
} from "@/lib/parseMsa";

const realMsa = fs.readFileSync(
  path.join(__dirname, "../../prisma/content/msaV3.md"),
  "utf8"
);

describe("parseRuns", () => {
  it("splits bold runs", () => {
    expect(parseRuns('a **bold** c')).toEqual([
      { text: "a ", bold: false },
      { text: "bold", bold: true },
      { text: " c", bold: false },
    ]);
  });
  it("drops a lone unmatched ** instead of leaking it into the signed MSA", () => {
    // RSL-17: a stray ** must never ship as a literal marker in a legal document.
    expect(parseRuns("a ** b")).toEqual([
      { text: "a ", bold: false },
      { text: " b", bold: false },
    ]);
  });
  it("keeps a real bold pair and drops a stray ** on an odd-asterisk line", () => {
    // RSL-17: an odd ** count must not drop the legit pair nor leak raw markers.
    const runs = parseRuns("**Important:** see ** clause");
    expect(runs.some((r) => r.bold)).toBe(true);
    expect(runs.find((r) => r.bold)?.text).toBe("Important:");
    expect(runs.every((r) => !r.text.includes("**"))).toBe(true);
  });
});

describe("parseMsa on the real v3 agreement", () => {
  const blocks = parseMsa(realMsa);

  it("finds all 37 section headings", () => {
    const headings = blocks.filter((b) => b.type === "heading");
    expect(headings).toHaveLength(37);
    expect(headings[0]).toMatchObject({ text: "1. Definitions" });
    expect(headings[36].text).toMatch(/^37\. Electronic Signatures/);
  });

  it("skips build comments", () => {
    const all = JSON.stringify(blocks);
    expect(all).not.toContain("Block syntax");
  });

  it("contains bullets and bold runs", () => {
    expect(blocks.some((b) => b.type === "bullet")).toBe(true);
    expect(
      blocks.some((b) => b.type !== "heading" && b.runs.some((r) => r.bold))
    ).toBe(true);
  });

  it("replaces all four merge tokens cleanly", () => {
    const replaced = replaceTokensInBlocks(blocks, {
      "Client.FirstName": "Dominique",
      "Client.LastName": "Norris",
      "Client.Company": "Scorpion Junk Removal",
      "Document.CreatedDate": "March 10, 2026",
    });
    expect(findUnreplacedTokens(replaced)).toEqual([]);
    expect(JSON.stringify(replaced)).toContain("Scorpion Junk Removal");
  });

  it("reports unreplaced tokens when some are missing", () => {
    const replaced = replaceTokensInBlocks(blocks, { "Client.FirstName": "Dominique" });
    expect(findUnreplacedTokens(replaced)).toContain("Client.Company");
  });
});

describe("replaceTokens", () => {
  it("leaves unknown tokens intact", () => {
    expect(replaceTokens("hi {{Nope.Missing}}", {})).toBe("hi {{Nope.Missing}}");
  });
  it("replaces a token padded with inner whitespace (RSL-17)", () => {
    expect(replaceTokens("hi {{ Client.Company }}", { "Client.Company": "Acme" })).toBe("hi Acme");
  });
});

describe("findUnreplacedTokens (RSL-17 send-time safety net)", () => {
  it("flags a whitespace-padded placeholder the renderer could not fill", () => {
    // The guard must share the replacer's token grammar; otherwise {{ spaced }} ships unflagged.
    const blocks = replaceTokensInBlocks(parseMsa("Prepared for {{ Client.Company }}."), {});
    expect(findUnreplacedTokens(blocks)).toContain("Client.Company");
  });
});
