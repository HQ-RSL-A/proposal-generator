import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_TONES, type StatusTone } from "@/components/dashboard/statusChip";
import { SUPPORT_EMAIL } from "@/lib/constants";

export type OutcomeTone = "success" | "info" | "wait" | "error" | "neutral";

/** Outcome tones ride THE status scale; `info` is the brand-blue hero treatment. */
const TONE_MAP: Record<OutcomeTone, StatusTone> = {
  success: "success",
  info: "brand",
  wait: "warning",
  error: "danger",
  neutral: "neutral",
};

export function OutcomeCard({
  icon: Icon,
  tone = "info",
  title,
  children,
}: {
  icon: LucideIcon;
  tone?: OutcomeTone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dot-pattern flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="document-page w-full max-w-md animate-in rounded-2xl border border-border bg-card p-6 text-center duration-300 ease-out fade-in-0 zoom-in-95 motion-reduce:animate-none sm:p-8">
        <Image
          src="/logomark.png"
          alt="RSL/A"
          width={36}
          height={36}
          className="mx-auto rounded-lg"
        />
        <div
          className={cn(
            "mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full ring-1",
            STATUS_TONES[TONE_MAP[tone]].icon
          )}
        >
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <h1 className="font-heading mt-4 text-xl font-bold">{title}</h1>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <p className="mt-6 text-xs text-muted-foreground/70">
          Questions? Write to our team at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
