import * as React from "react"

import { cn } from "@/lib/utils"

/* One card system for every surface (see docs/plans/ui-consistency-pass.md):
   variant = elevation language, tone = semantic fill, size = spacing + radius step.
   `flat` (admin chrome) and `outlined`/`raised` (document surfaces) are the two dialects
   the audit found hand-rolled 32 ways. */
const cardVariants = {
  flat: "ring-1 ring-foreground/10",
  outlined: "border border-border",
  raised:
    "border border-border shadow-[0_1px_3px_rgba(17,24,39,0.06),0_12px_40px_-12px_rgba(17,24,39,0.12)]",
  floating:
    "border border-border ring-1 ring-black/5 shadow-[0_-8px_24px_-12px_rgba(17,24,39,0.18),0_12px_34px_-6px_rgba(17,24,39,0.30)]",
} as const

const cardTones = {
  default: "",
  muted: "bg-surface",
  warning: "bg-warning-subtle/50 ring-warning/25 border-warning/25",
  danger: "bg-destructive-subtle/40 ring-destructive/25 border-destructive/40",
  accent: "bg-accent/50 ring-primary/25 border-primary/30",
} as const

function Card({
  className,
  size = "default",
  variant = "flat",
  tone = "default",
  dashed = false,
  hoverable = false,
  selected = false,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm" | "lg"
  variant?: keyof typeof cardVariants
  tone?: keyof typeof cardTones
  /** Dashed boundary (empty/optional zones). Pairs with variant="outlined". */
  dashed?: boolean
  /** Adds the shared .card-hover lift (pointer-gated in globals.css). */
  hoverable?: boolean
  /** Selected/active tile state (tier cards, font tiles, teammate rows). */
  selected?: boolean
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:rounded-lg data-[size=sm]:has-data-[slot=card-footer]:pb-0 data-[size=lg]:[--card-spacing:--spacing(6)] data-[size=lg]:rounded-2xl *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        cardVariants[variant],
        cardTones[tone],
        dashed && "border-dashed",
        hoverable && "card-hover",
        selected && "border-primary bg-accent shadow-sm ring-primary/40",
        className
      )}
      {...props}
    />
  )
}

/** Eyebrow label — the one uppercase micro-heading (replaces 9 hand-rolled treatments). */
function CardLabel({
  className,
  tone = "muted",
  ...props
}: React.ComponentProps<"p"> & { tone?: "muted" | "primary" | "warning" }) {
  return (
    <p
      data-slot="card-label"
      className={cn(
        "font-tag text-[11px] font-semibold uppercase tracking-widest",
        tone === "muted" && "text-muted-foreground",
        tone === "primary" && "text-primary",
        tone === "warning" && "text-warning-subtle-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardLabel,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
