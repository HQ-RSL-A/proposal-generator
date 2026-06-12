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

/** Splits "a **b** c" into runs. Unmatched ** is treated as literal text. */
export function parseRuns(line: string): MsaRun[] {
  const runs: MsaRun[] = [];
  const parts = line.split(/\*\*/);
  // Even count of "**" => odd number of parts => well-formed bold pairs.
  if (parts.length % 2 === 0) {
    return [{ text: line, bold: false }];
  }
  parts.forEach((part, i) => {
    if (part.length === 0) return;
    runs.push({ text: part, bold: i % 2 === 1 });
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

/** Replaces {{Token.Name}} placeholders. Unknown tokens are left intact (caught by tests). */
export function replaceTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{([\w.]+)\}\}/g, (match, key: string) => tokens[key] ?? match);
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
    for (const match of text.matchAll(/\{\{([\w.]+)\}\}/g)) found.add(match[1]);
  };
  for (const block of blocks) {
    if (block.type === "heading") scan(block.text);
    else block.runs.forEach((run) => scan(run.text));
  }
  return [...found];
}
