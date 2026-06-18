// Parses the MSA body markdown (msaV3.md block syntax) into a renderable AST.
// Syntax per the file header: "## " = section heading, "- " = bullet,
// "**text**" = bold run, plain line = paragraph, "# " = build comment (skipped),
// numbered "1. " lines render as plain text paragraphs.

export interface MsaRun {
  text: string;
  bold: boolean;
}

export type MsaBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; runs: MsaRun[] }
  | { type: "bullet"; runs: MsaRun[] };

/**
 * Splits "a **b** c" into runs; each "**" toggles bold. An odd (unclosed) "**" is dropped
 * rather than leaked as a literal marker into the signed MSA, and its trailing text stays
 * non-bold — so a stray "**" never ships and a legitimate bold pair on the same line is
 * never lost (RSL-17).
 */
export function parseRuns(line: string): MsaRun[] {
  const runs: MsaRun[] = [];
  const parts = line.split(/\*\*/);
  // Even part count <=> odd number of "**" markers (one is unclosed).
  const oddMarkers = parts.length % 2 === 0;
  parts.forEach((part, i) => {
    if (part.length === 0) return;
    // Odd indices sit inside a bold pair, except the final part of an odd-marker line:
    // its opening "**" never closed, so render it plain and let the stray marker drop.
    const bold = i % 2 === 1 && !(oddMarkers && i === parts.length - 1);
    runs.push({ text: part, bold });
  });
  return runs.length > 0 ? runs : [{ text: "", bold: false }];
}

export function parseMsa(bodyMarkdown: string): MsaBlock[] {
  const blocks: MsaBlock[] = [];
  for (const rawLine of bodyMarkdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim().length === 0) continue;
    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("# ")) continue; // build comments at the top of the file
    if (line.startsWith("- ")) {
      blocks.push({ type: "bullet", runs: parseRuns(line.slice(2)) });
      continue;
    }
    blocks.push({ type: "paragraph", runs: parseRuns(line) });
  }
  return blocks;
}

/**
 * Token grammar shared by the replacer and the send-time leftover-token guard so the two can
 * never drift: inner whitespace is tolerated ({{ Client.Company }}) and trimmed from the
 * captured key, so a placeholder the renderer can't fill is always caught before send (RSL-17).
 * A fresh RegExp per call avoids shared `lastIndex` state across the global-flag matches.
 */
const tokenPattern = () => /\{\{\s*([\w.]+)\s*\}\}/g;

/** Replaces {{Token.Name}} placeholders. Unknown tokens are left intact (caught by tests). */
export function replaceTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(tokenPattern(), (match, key: string) => tokens[key] ?? match);
}

export function replaceTokensInBlocks(
  blocks: MsaBlock[],
  tokens: Record<string, string>
): MsaBlock[] {
  return blocks.map((block) => {
    if (block.type === "heading") {
      return { ...block, text: replaceTokens(block.text, tokens) };
    }
    return {
      ...block,
      runs: block.runs.map((run) => ({ ...run, text: replaceTokens(run.text, tokens) })),
    };
  });
}

/** Any {{token}} left after replacement means a content bug — surfaced before send. */
export function findUnreplacedTokens(blocks: MsaBlock[]): string[] {
  const found = new Set<string>();
  const scan = (text: string) => {
    for (const match of text.matchAll(tokenPattern())) found.add(match[1]);
  };
  for (const block of blocks) {
    if (block.type === "heading") scan(block.text);
    else block.runs.forEach((run) => scan(run.text));
  }
  return [...found];
}
