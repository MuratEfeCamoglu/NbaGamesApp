"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative pointer light + tilt for its parent card (globals.css `[data-spotlight]`).
 * Writes --spot-x/--spot-y/--tilt-x/--tilt-y on the parent; fine pointers only, and skipped
 * entirely with prefers-reduced-motion. Renders an empty aria-hidden span, so it never
 * affects layout, text or the accessibility tree.
 */
export function Spotlight() {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host || typeof window.matchMedia !== "function") return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = host.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        host.style.setProperty("--spot-x", `${(px * 100).toFixed(1)}%`);
        host.style.setProperty("--spot-y", `${(py * 100).toFixed(1)}%`);
        // ±4° tilt: enough to feel physical, small enough to keep text crisp.
        host.style.setProperty("--tilt-x", `${((0.5 - py) * 8).toFixed(2)}deg`);
        host.style.setProperty("--tilt-y", `${((px - 0.5) * 8).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      host.style.setProperty("--tilt-x", "0deg");
      host.style.setProperty("--tilt-y", "0deg");
    };
    host.dataset.spotlight = "on";
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      delete host.dataset.spotlight;
    };
  }, []);

  return <span ref={ref} className="spotlight" aria-hidden="true" />;
}
