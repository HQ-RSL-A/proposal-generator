"use client";

import { toast } from "sonner";
import {
  Check,
  Info,
  OctagonX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BrandToastTone = "brand" | "success" | "error" | "warning" | "info";

/** White text on the four dark fills; amber is a LIGHT fill, so its text is
 * amber-950 (6.4:1 — white was 2.1:1, the app's last AA failure). Rahul picked
 * dark-on-amber 2026-08-09. */
const WHITE = { fg: "text-white", chip: "bg-white/20", desc: "text-white/85" };
const TONE: Record<
  BrandToastTone,
  { bg: string; fg: string; chip: string; desc: string; Icon: LucideIcon }
> = {
  brand: { bg: "bg-primary", ...WHITE, Icon: Check },
  success: { bg: "bg-success", ...WHITE, Icon: Check },
  error: { bg: "bg-destructive", ...WHITE, Icon: OctagonX },
  warning: {
    bg: "bg-amber-500",
    fg: "text-amber-950",
    chip: "bg-amber-950/10",
    desc: "text-amber-950/80",
    Icon: TriangleAlert,
  },
  info: { bg: "bg-foreground", ...WHITE, Icon: Info },
};

/**
 * Branded, top-center toast shared by the signing flow and admin actions, so action
 * feedback reads as deliberate instead of stock sonner. brand/error keep the signing-flow
 * look; success/info are for admin actions (saved, PDF rendering, and the like).
 */
export function brandToast(
  tone: BrandToastTone,
  title: string,
  description?: string,
  opts?: { id?: string; duration?: number }
) {
  const { bg, fg, chip, desc, Icon } = TONE[tone];
  toast.custom(
    () => (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          // Sonner sizes custom toasts to their content, which left-hugs short
          // title-only cards ("Draft deleted") inside the centered slot. Pinning to
          // sonner's own --width keeps every card identical and truly centered.
          "flex w-(--width) max-w-full items-start gap-2.5 rounded-xl px-3.5 py-2.5 shadow-lg ring-1 ring-foreground/10",
          bg,
          fg
        )}
      >
        <span
          className={cn("mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md", chip)}
        >
          <Icon className="h-3 w-3" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          {description ? (
            <p className={cn("mt-0.5 text-xs leading-snug", desc)}>{description}</p>
          ) : null}
        </div>
      </div>
    ),
    { position: "top-center", duration: opts?.duration ?? 5000, id: opts?.id }
  );
}

/* The old toast-based brandConfirm is gone — confirmation lives in
   `@/components/ui/confirm-dialog` (Dialog primitive, focus-trapped). */
