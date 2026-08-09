// Tiny inline-SVG sparklines for the dashboard metric cards. Pure presentational: the
// series come from dashboardMetrics, and callers gate visibility with hasSparklineSignal so
// these never render fake-looking charts. No hooks — safe as server components.

import { cn } from "@/lib/utils";

/* Chart hues come from the --chart-* tokens; the ramp is the token at rising opacity
   so the latest month reads strongest (plan Phase 2 §2: no raw chart hexes). */
const TONE_VAR = { blue: "var(--chart-1)", green: "var(--chart-3)" } as const;
const RAMP_OPACITY = [0.28, 0.5, 1] as const;

/** Bars grow oldest -> newest, with the ramp deepening so the latest month reads strongest. */
export function BarSparkline({
  data,
  tone = "blue",
  width = 116,
  height = 46,
  gap = 7,
  fluid = false,
  className,
}: {
  data: number[];
  tone?: "blue" | "green";
  width?: number;
  height?: number;
  gap?: number;
  /** Stretch to the container width (used inside cards) instead of a fixed pixel width. */
  fluid?: boolean;
  className?: string;
}) {
  const fill = TONE_VAR[tone];
  const max = Math.max(...data, 1);
  const n = data.length;
  const barW = (width - gap * (n - 1)) / n;
  return (
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? "none" : "xMidYMid meet"}
      className={cn("block", className)}
      aria-hidden
    >
      {data.map((v, i) => {
        const h = Math.max(3, Math.round((v / max) * height));
        const x = i * (barW + gap);
        const ratio = n > 1 ? i / (n - 1) : 1;
        const opacity = ratio < 0.5 ? RAMP_OPACITY[0] : ratio < 0.999 ? RAMP_OPACITY[1] : RAMP_OPACITY[2];
        return (
          <rect
            key={i}
            x={x}
            y={height - h}
            width={barW}
            height={h}
            rx={2.5}
            fill={fill}
            fillOpacity={opacity}
          />
        );
      })}
    </svg>
  );
}

/** A smoothed trend line with an emphasized endpoint. Skips null (no-data) months. */
export function LineSparkline({
  data,
  width = 100,
  height = 30,
  color = "var(--chart-1)",
}: {
  data: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const pts = data
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return null;

  const vals = pts.map((p) => p.v);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = max - min || 1;
  const n = data.length;
  const pad = 3;
  const coords = pts.map((p) => {
    const x = n > 1 ? (p.i / (n - 1)) * width : width / 2;
    const y = height - pad - ((p.v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = coords
    .map(([x, y], k) => `${k === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const [lx, ly] = coords[coords.length - 1];

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r={2.6} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
