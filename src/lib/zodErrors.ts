import type { ZodError } from "zod";

type LooseIssue = {
  code: string;
  message: string;
  path: ReadonlyArray<PropertyKey>;
  minimum?: unknown;
  maximum?: unknown;
};

/** "Client.LastName" / ["tiers", 0, "amountCents"] -> "Last name" / "Amount cents". */
function labelFromPath(path: ReadonlyArray<PropertyKey>): string {
  const strings = path.filter((p): p is string => typeof p === "string");
  const raw = strings.length ? strings[strings.length - 1] : "";
  const leaf = raw.includes(".") ? (raw.split(".").pop() ?? raw) : raw;
  if (!leaf) return "This value";
  const spaced = leaf.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function describeIssue(issue: LooseIssue, label: string): string {
  switch (issue.code) {
    case "too_small": {
      const min = Number(issue.minimum);
      return min <= 1
        ? `${label} is required.`
        : `${label} must be at least ${min} characters.`;
    }
    case "too_big":
      return `${label} must be at most ${Number(issue.maximum)} characters.`;
    case "invalid_type":
      // A required field that's missing or the wrong type reads best as "required".
      return `${label} is required.`;
    default: {
      const msg = issue.message.replace(/\.+$/, "");
      return `${label}: ${msg.charAt(0).toUpperCase() + msg.slice(1)}.`;
    }
  }
}

/** Turn a ZodError into a short, plain-English message suited to a toast. */
export function humanizeZodError(error: ZodError): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const issue of error.issues as unknown as LooseIssue[]) {
    const line = describeIssue(issue, labelFromPath(issue.path));
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  return lines.length ? lines.join(" ") : "Please check the form and try again.";
}
