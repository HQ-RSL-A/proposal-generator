// The "Insightful" metric cards: an MRR hero plus calmer KPI cards. Presentational only —
// the dashboard page computes every value (via dashboardMetrics) and passes display strings.
// No hooks, so these stay server components and the sparkline SVGs render on the server.

import type { ReactNode } from "react";
import { AlarmClock, ArrowDown, ArrowUp, Check, Clock, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardLabel } from "@/components/ui/card";
import { BarSparkline, LineSparkline } from "./sparkline";

function IconChip({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", className)}>
      {children}
    </span>
  );
}

const VALUE = "font-heading text-3xl font-bold tabular-nums";

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
    <Card
      size="lg"
      hoverable
      className="col-span-2 bg-[linear-gradient(155deg,var(--accent)_0%,var(--card)_46%)] lg:row-span-2"
    >
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <CardLabel tone="primary">Monthly recurring revenue</CardLabel>
          <IconChip className="h-8 w-8 bg-primary text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
          </IconChip>
        </div>

        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-heading text-4xl font-bold leading-none tabular-nums sm:text-5xl">
            {valueLabel}
          </span>
          <span className="text-lg font-medium text-muted-foreground">/mo</span>
        </div>

        {deltaLabel ? (
          <div className="mt-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2.5 py-1 text-xs font-semibold text-success-subtle-foreground">
              <ArrowUp className="h-3 w-3" />
              {deltaLabel}
            </span>
          </div>
        ) : null}

        <div className="flex-1" />

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-border-subtle pt-4">
          <div>
            <CardLabel>Contracted one-time</CardLabel>
            <p className="font-heading mt-1.5 text-2xl font-bold tabular-nums">{contractedLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">build fees on signed deals</p>
          </div>
          {showSparkline ? (
            <div className="shrink-0 text-right">
              <BarSparkline data={series} tone="blue" />
              <p className="mt-1.5 text-xs text-muted-foreground">last 6 months</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function WinRateCard({ pct, sub }: { pct: number; sub: string }) {
  return (
    <Card size="lg" hoverable>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <CardLabel>Win rate</CardLabel>
          <IconChip className="bg-accent text-primary">
            <Target className="h-4 w-4" />
          </IconChip>
        </div>
        <p className={cn(VALUE, "mt-3")}>{pct}%</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border-subtle">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
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
    <Card size="lg" hoverable>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <CardLabel>Signed this month</CardLabel>
          <IconChip className="bg-success-subtle text-success">
            <Check className="h-4 w-4" />
          </IconChip>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={VALUE}>{value}</span>
          {deltaLabel ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold",
                deltaTone === "up" ? "text-success-subtle-foreground" : "text-destructive"
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
        <p className="mt-3 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
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
    <Card size="lg" hoverable>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <CardLabel>Avg time to sign</CardLabel>
          <IconChip className="bg-accent text-primary">
            <Clock className="h-4 w-4" />
          </IconChip>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={VALUE}>{valueLabel}</span>
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold",
                trend === "faster"
                  ? "text-success-subtle-foreground"
                  : "text-warning-subtle-foreground"
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
        <p className="mt-3 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
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
    <Card size="lg" hoverable tone={warn ? "warning" : "default"}>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start justify-between">
          <CardLabel tone={warn ? "warning" : "muted"}>Oldest open</CardLabel>
          <IconChip
            className={
              warn ? "bg-warning-subtle text-warning-subtle-foreground" : "bg-accent text-primary"
            }
          >
            <AlarmClock className="h-4 w-4" />
          </IconChip>
        </div>
        <p className={cn(VALUE, "mt-3", warn && "text-warning-subtle-foreground")}>{valueLabel}</p>
        <div className="flex-1" />
        <p
          className={cn(
            "mt-4 text-xs font-medium",
            warn ? "text-warning-subtle-foreground/70" : "text-muted-foreground"
          )}
        >
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}
