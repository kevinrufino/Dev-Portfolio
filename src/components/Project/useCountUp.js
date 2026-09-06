import { useEffect, useRef } from 'react';

/**
 * Counts a number up when it first scrolls into view.
 *
 * Writes to the node directly rather than through state: the value changes
 * every frame for ~900ms and none of that belongs in a React render. The
 * element keeps its final value in the markup, so with JS disabled, under
 * reduced motion, or before the observer fires, the real figure is what shows —
 * the animation only ever replaces a correct value with the same correct value.
 *
 * @param {number} to - the final value.
 * @param {number} decimals - fixed decimal places.
 * @param {string} suffix - appended verbatim (%, ×, fps…).
 */
const DURATION_MS = 900;

export default function useCountUp(to, decimals, suffix) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    if (!('IntersectionObserver' in window)) return undefined;

    let raf = 0;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const frame = now => {
          const p = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = `${(to * eased).toFixed(decimals)}${suffix}`;
          if (p < 1) raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      },
      // Most of the number has to be on screen — a figure that finishes
      // counting before you can see it is just a flicker.
      { threshold: 0.6 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, decimals, suffix]);

  return ref;
}
