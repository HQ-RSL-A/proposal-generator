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

const SPRING = { stiffness: 150, damping: 20, mass: 0.5 };
const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * The dashboard screenshot as the landing centerpiece: it enters with a fade + lift, then
 * tilts a few degrees toward the cursor (spring-smoothed) over a spotlight glow that drifts
 * behind it for depth. The PNG carries its own window chrome and shadow (transparent
 * margins), so no frame is added. Pointer-only and reduced-motion safe.
 */
export function AppPreview() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [4, -4]), SPRING);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [-3, 3]), SPRING);
  const glowX = useSpring(useTransform(px, [-0.5, 0.5], [44, -44]), SPRING);

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
      className="relative mx-auto w-full max-w-5xl perspective-[1600px]"
    >
      {/* Spotlight glows behind the screen */}
      <motion.div
        aria-hidden
        style={reduce ? undefined : { x: glowX }}
        className="pointer-events-none absolute inset-x-0 -top-20 -z-10 mx-auto h-105 max-w-3xl rounded-full bg-primary/25 blur-[110px]"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-10 right-10 -z-10 h-64 w-64 rounded-full bg-[#00C2FF]/20 blur-[90px]"
      />
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.97 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative"
      >
        <Image
          src="/appPreview.png"
          alt="The RSL/A Proposals dashboard: win rate, contracted value, MRR and signing stats above a list of proposals with their status and value."
          width={1472}
          height={1077}
          priority
          draggable={false}
          className="h-auto w-full select-none"
        />
      </motion.div>
    </div>
  );
}
