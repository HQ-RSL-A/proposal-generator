"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Single-line-semantics input that wraps and grows (field-sizing) so long values stay
 * fully visible instead of clipping like a fixed <input>. The value never contains a
 * newline: Enter is ignored and pasted newlines collapse to spaces.
 */
function GrowingInput({
  className,
  onChange,
  onKeyDown,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      rows={1}
      {...props}
      className={cn("min-h-8 py-1.5 leading-tight", className)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
        onKeyDown?.(event);
      }}
      onChange={(event) => {
        if (event.target.value.includes("\n")) {
          event.target.value = event.target.value.replace(/\s*\n+\s*/g, " ");
        }
        onChange?.(event);
      }}
    />
  );
}

export { GrowingInput };
