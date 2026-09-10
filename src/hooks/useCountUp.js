import { useEffect, useRef } from 'react';

/**
 * Counts a number up when it first scrolls into view.
 *
 * Reports each frame's value to a callback rather than writing anything
 * itself: the value changes every frame for ~900ms and none of that belongs in
 * a React render, but nor does this hook need to know whether it is driving a
 * text node or a stack of digit columns.
 *
 * Nothing runs under reduced motion, without an IntersectionObserver, or
 * before the observer fires — so whatever the caller renders on its own is the
 * value that shows in all three cases. The animation only ever replaces a
 * correct value with the same correct value.
 *
 * @param {number} to - the final value.
 * @param {(value: number) => void} onFrame - called with the value each frame.
 * @param {boolean} enabled - false leaves the final value alone.
 * @returns {import('react').RefObject} attach to the element to observe.
 */
const DURATION_MS = 900;

export default function useCountUp(to, onFrame, enabled = true) {
  const ref = useRef(null);
  // Held in a ref so a caller that rebuilds the callback every render — which
  // is every caller, since it closes over the element being written — does not
  // restart the count.
  const frameCb = useRef(onFrame);
  frameCb.current = onFrame;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
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
          frameCb.current(to * eased);
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
  }, [to, enabled]);

  return ref;
}
