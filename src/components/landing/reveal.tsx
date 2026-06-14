"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

/** Emil's strong ease-out. */
const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * A fade-up reveal. Above-the-fold use `immediate` (animates on mount, for a staggered
 * hero entrance); below-the-fold leaves it off (animates once when scrolled into view).
 * Reduced-motion safe: keeps the opacity fade, drops the movement.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  immediate = false,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  immediate?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const initial = reduce ? { opacity: 0 } : { opacity: 0, y };
  const shown = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };
  const transition = { duration: 0.55, delay, ease: EASE };

  if (immediate) {
    return (
      <motion.div className={className} initial={initial} animate={shown} transition={transition}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={shown}
      viewport={{ once: true, margin: "-80px" }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
