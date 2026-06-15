// Tiny inline-SVG sparklines for the dashboard metric cards. Pure presentational: the
// series come from dashboardMetrics, and callers gate visibility with hasSparklineSignal so
// these never render fake-looking charts. No hooks — safe as server components.

import { cn } from "@/lib/utils";

const BLUE_RAMP = ["#BFDBFE", "#93C5FD", "#0070F3"] as const;
const GREEN_RAMP = ["#D1FAE5", "#A7F3D0", "#059669"] as const;

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
  const ramp = tone === "green" ? GREEN_RAMP : BLUE_RAMP;
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
        const fill = ratio < 0.5 ? ramp[0] : ratio < 0.999 ? ramp[1] : ramp[2];
        return <rect key={i} x={x} y={height - h} width={barW} height={h} rx={2.5} fill={fill} />;
      })}
    </svg>
  );
}

/** A smoothed trend line with an emphasized endpoint. Skips null (no-data) months. */
export function LineSparkline({
  data,
  width = 100,
  height = 30,
  color = "#0070F3",
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
