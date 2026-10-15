import { useEffect, useRef } from 'react';

/**
 * Play a video while it is near the viewport, and only then.
 *
 * Every figure in a case study used to be `autoplay loop`. `autoplay` overrides
 * `preload`, and a video that must play must buffer — so opening Max's Lab
 * started five concurrent streams before the reader had scrolled a pixel,
 * against 27MB of source. Scrolling the whole page afterwards issued no further
 * requests, because there were none left to make: everything had already begun.
 *
 * So the video is handed no `autoplay` and `preload="none"`, which means the
 * browser fetches nothing at all until something calls `play()`. This is the
 * thing that calls it, when the figure comes within a screen of the viewport,
 * and pauses it again when it leaves. A poster frame holds the slot in the
 * meantime, so an unplayed figure is a still rather than a hole.
 *
 * Paused is not the same as unloaded — once a clip has played it stays in the
 * browser's cache, which is what makes scrolling back up free. The saving is on
 * everything the reader never reaches.
 *
 * ── reduced motion ──────────────────────────────────────────────────────────
 *
 * Nothing plays by itself. Five looping videos is exactly what
 * `prefers-reduced-motion` is asking about, and the poster is a real
 * alternative rather than a degraded one — the inspector is still there for
 * anyone who wants the motion, and opening it is a deliberate act.
 *
 * @param {string} [src] - absent for an empty slot, in which case nothing runs.
 */
const LEAD = '100% 0px'; // a screen of warning on either side

export default function usePlayWhenVisible(src) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src || el.tagName !== 'VIDEO') return undefined;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    if (!('IntersectionObserver' in window)) {
      // No observer to gate on: behave the way the page did before, rather than
      // leaving a figure that never plays.
      el.play?.().catch(() => {});
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Rejected autoplay is not exceptional — a background tab is enough
            // to cause it — and there is nothing useful to do about it.
            el.play?.().catch(() => {});
          } else {
            el.pause?.();
          }
        }
      },
      { rootMargin: LEAD, threshold: 0 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      el.pause?.();
    };
  }, [src]);

  return ref;
}
