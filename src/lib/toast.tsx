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
          "flex w-full items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-white shadow-lg ring-1 ring-black/10",
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

/**
 * Branded confirm that replaces the browser's native confirm() "system card" with a
 * top-center card from the same family as brandToast — so a destructive choice reads as
 * part of the product, not a stock OS dialog. Resolves true on confirm, false on cancel,
 * dismiss, or timeout. Stays up until the user chooses (duration: Infinity).
 */
export function brandConfirm({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  icon: Icon = TriangleAlert,
  tone = "danger",
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  tone?: "danger" | "default";
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (id: string | number, value: boolean) => {
      if (settled) return;
      settled = true;
      toast.dismiss(id);
      resolve(value);
    };
    toast.custom(
      (id) => (
        <div className="flex w-full items-start gap-2.5 rounded-xl bg-foreground px-3.5 py-3 text-white shadow-lg ring-1 ring-black/10">
          <span
            className={cn(
              "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
              tone === "danger" ? "bg-red-500/20 text-red-300" : "bg-white/20 text-white"
            )}
          >
            <Icon className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{title}</p>
            {description ? (
              <p className="mt-0.5 text-xs leading-snug text-white/85">{description}</p>
            ) : null}
            <div className="mt-2.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => finish(id, false)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 transition-[transform,color,background-color] duration-150 ease-out hover:bg-white/10 hover:text-white active:scale-[0.97]"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => finish(id, true)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]",
                  tone === "danger"
                    ? "bg-red-500 text-white hover:bg-red-400"
                    : "bg-white text-foreground hover:bg-white/90"
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ),
      {
        position: "top-center",
        duration: Infinity,
        onDismiss: () => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        },
        onAutoClose: () => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        },
      }
    );
  });
}
