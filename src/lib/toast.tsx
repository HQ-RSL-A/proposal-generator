"use client";

import { toast } from "sonner";
import { Check, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandToastTone = "brand" | "success" | "error" | "info";

const TONE: Record<BrandToastTone, { bg: string; Icon: typeof Check }> = {
  brand: { bg: "bg-primary", Icon: Check },
  success: { bg: "bg-emerald-600", Icon: Check },
  error: { bg: "bg-red-600", Icon: TriangleAlert },
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
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-white shadow-xl ring-1 ring-black/10",
          bg
        )}
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Icon className="h-3.5 w-3.5" />
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
