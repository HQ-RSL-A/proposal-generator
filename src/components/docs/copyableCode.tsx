"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

/** A code block with a click-to-copy button. Used across the import-schema docs.
 * `label` names the region landmark for screen readers — unique per page. */
export function CopyableCode({ code, label = "Code example" }: { code: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail quietly.
    }
  }

  return (
    <div className="relative">
      {/* Focusable so keyboard users can scroll long examples horizontally. */}
      <pre
        tabIndex={0}
        role="region"
        aria-label={label}
        className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 pr-16 font-mono text-xs leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
