"use client";

import * as React from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

const SPRING = { stiffness: 150, damping: 18, mass: 0.4 };

/**
 * The interactive element on the sign-in page: a mock signed-and-paid proposal card that
 * tilts toward the cursor (spring-smoothed) with a glow that drifts behind it for depth.
 * Reduced-motion safe and pointer-only (the panel is hidden on touch/mobile anyway).
 */
export function SignInVisual() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [7, -7]), SPRING);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [-7, 7]), SPRING);
  const glowX = useSpring(useTransform(px, [-0.5, 0.5], [24, -24]), SPRING);
  const glowY = useSpring(useTransform(py, [-0.5, 0.5], [24, -24]), SPRING);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      onPointerMove={handleMove}
      onPointerLeave={reset}
      className="relative flex w-full max-w-sm items-center justify-center [perspective:1200px]"
    >
      <motion.div
        aria-hidden
        style={reduce ? undefined : { x: glowX, y: glowY }}
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-primary/20 blur-3xl"
      />
      <motion.div
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative w-full rounded-2xl border border-border bg-white p-5 shadow-[0_1px_3px_rgba(17,24,39,0.06),0_30px_60px_-24px_rgba(17,24,39,0.25)]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logomark.png" alt="" width={22} height={22} className="rounded" />
            <span className="text-xs font-semibold">Growth Marketing System</span>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Signed
          </span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-2 w-3/4 rounded bg-muted" />
          <div className="h-2 w-full rounded bg-muted" />
          <div className="h-2 w-2/3 rounded bg-muted" />
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-accent/50 p-3">
          <p className="font-tag text-[10px] uppercase tracking-wide text-muted-foreground">
            Signature
          </p>
          <p className="font-[cursive] text-xl leading-tight text-foreground">Dominique Norris</p>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Paid in full</span>
          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
            $3,000 paid
          </span>
        </div>
      </motion.div>
    </div>
  );
}
