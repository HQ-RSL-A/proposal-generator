// The "Insightful" metric cards: an MRR hero plus calmer KPI cards. Presentational only —
// the dashboard page computes every value (via dashboardMetrics) and passes display strings.
// No hooks, so these stay server components and the sparkline SVGs render on the server.

import type { ReactNode } from "react";
import { AlarmClock, ArrowDown, ArrowUp, Check, Clock, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarSparkline, LineSparkline } from "./sparkline";

const CARD = "rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.07] card-hover";

function CardLabel({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "warn";
}) {
  return (
    <p
      className={cn(
        "font-tag text-[10.5px] font-semibold uppercase tracking-[0.08em]",
        tone === "primary" && "text-primary",
        tone === "warn" && "text-amber-700",
        tone === "muted" && "text-muted-foreground"
      )}
    >
      {children}
    </p>
  );
}

function IconChip({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", className)}>
      {children}
    </span>
  );
}

const VALUE = "font-heading text-3xl font-bold tabular-nums tracking-[-0.02em]";

/** The MRR hero: spans 2×2 on desktop, full-width above it. */
export function HeroMetric({
  valueLabel,
  deltaLabel,
  contractedLabel,
  series,
  showSparkline,
}: {
  valueLabel: string;
  deltaLabel: string | null;
  contractedLabel: string;
  series: number[];
  showSparkline: boolean;
}) {
  return (
    <div
      className="col-span-2 flex flex-col rounded-2xl p-6.5 ring-1 ring-foreground/[0.07] card-hover lg:row-span-2"
      style={{ backgroundImage: "linear-gradient(155deg,#F4F8FF 0%,#FFFFFF 46%)" }}
    >
      <div className="flex items-start justify-between">
        <CardLabel tone="primary">Monthly recurring revenue</CardLabel>
        <IconChip className="h-8 w-8 rounded-[10px] bg-primary text-white">
          <TrendingUp className="h-4 w-4" />
        </IconChip>
      </div>

      <div className="mt-3.5 flex items-baseline gap-1">
        <span className="font-heading text-[40px] font-bold leading-none tabular-nums tracking-[-0.03em] sm:text-5xl">
          {valueLabel}
        </span>
        <span className="text-lg font-medium text-muted-foreground">/mo</span>
      </div>

      {deltaLabel ? (
        <div className="mt-3.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <ArrowUp className="h-3 w-3" />
            {deltaLabel}
          </span>
        </div>
      ) : null}

      <div className="flex-1" />

      <div className="mt-5.5 flex items-end justify-between gap-4 border-t border-[#E9EDF3] pt-4.5">
        <div>
          <CardLabel>Contracted one-time</CardLabel>
          <p className="font-heading mt-1.5 text-2xl font-bold tabular-nums tracking-[-0.02em]">
            {contractedLabel}
          </p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">build fees on signed deals</p>
        </div>
        {showSparkline ? (
          <div className="shrink-0 text-right">
            <BarSparkline data={series} tone="blue" />
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">last 6 months</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function WinRateCard({ pct, sub }: { pct: number; sub: string }) {
  return (
    <div className={cn(CARD, "flex flex-col")}>
      <div className="flex items-start justify-between">
        <CardLabel>Win rate</CardLabel>
        <IconChip className="bg-accent text-primary">
          <Target className="h-3.75 w-3.75" />
        </IconChip>
      </div>
      <p className={cn(VALUE, "mt-2.5")}>{pct}%</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF1F6]">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2.5 text-[11.5px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export function SignedThisMonthCard({
  value,
  deltaLabel,
  deltaTone,
  series,
  showSparkline,
  sub,
}: {
  value: number;
  deltaLabel: string | null;
  deltaTone: "up" | "down";
  series: number[];
  showSparkline: boolean;
  sub: string;
}) {
  return (
    <div className={cn(CARD, "flex flex-col")}>
      <div className="flex items-start justify-between">
        <CardLabel>Signed this month</CardLabel>
        <IconChip className="bg-emerald-50 text-emerald-600">
          <Check className="h-3.75 w-3.75" />
        </IconChip>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className={VALUE}>{value}</span>
        {deltaLabel ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              deltaTone === "up" ? "text-emerald-700" : "text-rose-600"
            )}
          >
            {deltaTone === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {deltaLabel}
          </span>
        ) : null}
      </div>
      {showSparkline ? (
        <div className="mt-3">
          <BarSparkline data={series} tone="green" fluid width={100} height={28} />
        </div>
      ) : null}
      <p className="mt-2.5 text-[11.5px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export function AvgTimeCard({
  valueLabel,
  trend,
  series,
  showSparkline,
  sub,
}: {
  valueLabel: string;
  trend: "faster" | "slower" | null;
  series: (number | null)[];
  showSparkline: boolean;
  sub: string;
}) {
  return (
    <div className={cn(CARD, "flex flex-col")}>
      <div className="flex items-start justify-between">
        <CardLabel>Avg time to sign</CardLabel>
        <IconChip className="bg-accent text-primary">
          <Clock className="h-3.75 w-3.75" />
        </IconChip>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className={VALUE}>{valueLabel}</span>
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              trend === "faster" ? "text-emerald-700" : "text-amber-600"
            )}
          >
            {trend === "faster" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            {trend}
          </span>
        ) : null}
      </div>
      {showSparkline ? (
        <div className="mt-3">
          <LineSparkline data={series} />
        </div>
      ) : null}
      <p className="mt-2.5 text-[11.5px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export function OldestOpenCard({
  valueLabel,
  sub,
  warn,
}: {
  valueLabel: string;
  sub: string;
  warn: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl p-5 card-hover",
        warn ? "bg-amber-50 ring-1 ring-amber-500/20" : "bg-card ring-1 ring-foreground/[0.07]"
      )}
    >
      <div className="flex items-start justify-between">
        <CardLabel tone={warn ? "warn" : "muted"}>Oldest open</CardLabel>
        <IconChip className={warn ? "bg-amber-100 text-amber-600" : "bg-accent text-primary"}>
          <AlarmClock className="h-3.75 w-3.75" />
        </IconChip>
      </div>
      <p className={cn(VALUE, "mt-2.5", warn && "text-amber-700")}>{valueLabel}</p>
      <div className="flex-1" />
      <p
        className={cn(
          "mt-3.5 text-[11.5px] font-medium",
          warn ? "text-amber-700/70" : "text-muted-foreground"
        )}
      >
        {sub}
      </p>
    </div>
  );
}
