"use client";

import * as React from "react";
import { TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  tone?: "danger" | "default";
}

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

let enqueue: ((next: PendingConfirm) => void) | null = null;

/**
 * Promise-based confirm on the Dialog primitive (focus trap, Esc/backdrop = cancel) —
 * the one confirm pattern for admin choices. Drop-in for the old toast-based
 * brandConfirm; resolves false when <ConfirmDialogHost /> isn't mounted.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!enqueue) return resolve(false);
    enqueue({ options, resolve });
  });
}

/** Mounted once in AppShell; renders the active confirmDialog() request. */
export function ConfirmDialogHost() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    enqueue = (next) => {
      setPending((prev) => {
        prev?.resolve(false); // a newer request supersedes an unanswered one
        return next;
      });
      // Open on a fresh task: the click that requested this confirm is still
      // bubbling, and a dialog mounted mid-propagation reads that same click as
      // an outside press and dismisses itself instantly. (setTimeout, not rAF —
      // rAF stalls in occluded/background windows.)
      window.setTimeout(() => setOpen(true), 0);
    };
    return () => {
      enqueue = null;
    };
  }, []);

  // `pending` stays mounted through the exit animation; the open flag guards
  // against resolving twice (confirm click + the controlled close that follows).
  const settle = (value: boolean) => {
    if (!open) return;
    pending?.resolve(value);
    setOpen(false);
  };

  const options = pending?.options;
  const tone = options?.tone ?? "danger";
  const Icon = options?.icon ?? TriangleAlert;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : settle(false))}>
      <DialogContent showCloseButton={false}>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
              tone === "danger"
                ? "bg-destructive-subtle text-destructive-subtle-foreground"
                : "bg-accent text-primary"
            )}
          >
            <Icon className="size-4" />
          </span>
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>
            {options?.description ? (
              <DialogDescription>{options.description}</DialogDescription>
            ) : null}
          </DialogHeader>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
