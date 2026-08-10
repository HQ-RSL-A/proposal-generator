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

const TONE: Record<BrandToastTone, { bg: string; Icon: LucideIcon }> = {
  brand: { bg: "bg-primary", Icon: Check },
  success: { bg: "bg-emerald-600", Icon: Check },
  error: { bg: "bg-red-600", Icon: OctagonX },
  warning: { bg: "bg-amber-500", Icon: TriangleAlert },
  info: { bg: "bg-foreground", Icon: Info },
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
  const { bg, Icon } = TONE[tone];
  toast.custom(
    () => (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex w-full items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-white shadow-lg ring-1 ring-foreground/10",
          bg
        )}
      >
        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/20">
          <Icon className="h-3 w-3" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs leading-snug text-white/85">{description}</p>
          ) : null}
        </div>
      </div>
    ),
    { position: "top-center", duration: opts?.duration ?? 5000, id: opts?.id }
  );
}

/* The old toast-based brandConfirm is gone — confirmation lives in
   `@/components/ui/confirm-dialog` (Dialog primitive, focus-trapped). */
