import { cn } from "@/lib/utils";

/** Loading placeholder block. Pulse is opacity-only, so it stays under
    prefers-reduced-motion; shape/size come from the call site. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-lg bg-border-subtle", className)}
      {...props}
    />
  );
}
