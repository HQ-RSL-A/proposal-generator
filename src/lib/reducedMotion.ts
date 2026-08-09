/* JS scrollIntoView ignores the CSS scroll-behavior gate in globals.css, so every
   programmatic scroll resolves its behavior through here. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function appScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
