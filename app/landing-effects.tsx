"use client";

import { useEffect } from "react";

export default function LandingEffects() {
  useEffect(() => {
    const motion = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const nodes = [...document.querySelectorAll<HTMLElement>(".feature-card, .hero-art")];
    const cleanups = nodes.map(node => {
      let frame = 0;
      let bounds: DOMRect | null = null;
      const reset = () => {
        cancelAnimationFrame(frame);
        bounds = null;
        node.style.removeProperty("--rx");
        node.style.removeProperty("--ry");
        node.style.removeProperty("--glow-x");
        node.style.removeProperty("--glow-y");
        node.removeAttribute("data-tilting");
      };
      const move = (event: PointerEvent) => {
        if (!motion.matches || event.pointerType !== "mouse") return;
        bounds ??= node.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          node.dataset.tilting = "true";
          node.style.setProperty("--rx", ((0.5 - y) * 14).toFixed(2) + "deg");
          node.style.setProperty("--ry", ((x - 0.5) * 18).toFixed(2) + "deg");
          node.style.setProperty("--glow-x", x * 100 + "%");
          node.style.setProperty("--glow-y", y * 100 + "%");
        });
      };
      node.addEventListener("pointermove", move);
      node.addEventListener("pointerleave", reset);
      node.addEventListener("pointercancel", reset);
      motion.addEventListener("change", reset);
      return () => {
        reset();
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerleave", reset);
        node.removeEventListener("pointercancel", reset);
        motion.removeEventListener("change", reset);
      };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, []);
  return null;
}
