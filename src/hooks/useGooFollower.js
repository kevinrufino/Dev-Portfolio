import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The spring-follower behind the gooey pill groups.
 *
 * A blob chases the pointer with a critically-ish damped spring and swells as
 * the pointer nears the group. On its own it is invisible; inside an SVG goo
 * filter alongside the item pills it makes the pills bulge toward the cursor
 * and bridge into one another, which is the whole effect. Without the
 * follower the pills just fade, and the group reads as ordinary buttons.
 *
 * Measurement lives here too: the pills are absolutely positioned from the
 * measured rects of the real interactive elements, so the goo layer can sit in
 * its own stacking/filter context without the filter touching the text.
 *
 * Same constants as the nav's implementation, so the two groups feel identical.
 *
 * The blob TRACKS the pointer; it does not chase it. It used to run on a
 * spring with velocity, which overshot every direction change and left it
 * swinging past the pills and back like something on the end of a string —
 * motion the pointer had not asked for. A flat exponential ease has the same
 * softness on arrival with none of the wobble.
 *
 * Mouse only, and only where there is a fine pointer at all. A tap fires a
 * single pointermove, which primed the blob and left it sitting on the page
 * as a stray dot with nothing to follow.
 *
 * @param {number} count - number of items to measure.
 * @param {number} range - px from the group at which the blob starts to swell.
 */
const FOLLOW_EASE = 0.34;
const NEAR_EASE = 0.13;
// The goo layer is inset by this much on every side so the blur has room to
// work without being clipped; every measured coordinate is offset to match.
export const GOO_PAD = 90;

export default function useGooFollower(count, range = 300) {
  const groupRef = useRef(null);
  const followerRef = useRef(null);
  const itemRefs = useRef([]);
  const [rects, setRects] = useState([]);

  const setItemRef = useCallback(
    index => el => {
      itemRefs.current[index] = el;
    },
    [],
  );

  const measure = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    const box = group.getBoundingClientRect();
    setRects(
      itemRefs.current.slice(0, count).map(el => {
        if (!el) return { x: 0, y: 0, w: 0, h: 0 };
        const r = el.getBoundingClientRect();
        return {
          x: r.left - box.left,
          y: r.top - box.top,
          w: r.width,
          h: r.height,
        };
      }),
    );
  }, [count]);

  useEffect(() => {
    requestAnimationFrame(measure);
    // Pixel fonts land late and change the pills' width when they do.
    document.fonts?.ready.then(() => requestAnimationFrame(measure));
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    if (window.matchMedia?.('(pointer: fine)').matches === false) {
      return undefined;
    }

    const p = {
      px: 0, py: 0, tx: 0, ty: 0,
      near: 0, targetNear: 0, primed: false,
    };

    const onMove = event => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      const group = groupRef.current;
      if (!group) return;
      const box = group.getBoundingClientRect();
      p.tx = event.clientX - box.left;
      p.ty = event.clientY - box.top;
      // Distance to the group's box, zero when inside it.
      const dx = Math.max(box.left - event.clientX, 0, event.clientX - box.right);
      const dy = Math.max(box.top - event.clientY, 0, event.clientY - box.bottom);
      const d = Math.hypot(dx, dy);
      p.targetNear = d >= range ? 0 : 1 - d / range;
      // Teleport on the first sample so the blob doesn't fly in from (0,0).
      if (!p.primed) {
        p.primed = true;
        p.px = p.tx;
        p.py = p.ty;
      }
    };

    let raf = 0;
    const loop = () => {
      p.px += (p.tx - p.px) * FOLLOW_EASE;
      p.py += (p.ty - p.py) * FOLLOW_EASE;
      p.near += (p.targetNear - p.near) * NEAR_EASE;
      const el = followerRef.current;
      if (el && p.primed) {
        el.style.transform =
          `translate3d(${p.px - 12 + GOO_PAD}px, ${p.py - 12 + GOO_PAD}px, 0)` +
          ` scale(${0.55 + 0.45 * p.near})`;
        el.style.opacity = String(Math.min(1, 0.25 + p.near * 1.35));
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [range]);

  return { groupRef, followerRef, setItemRef, rects, measure };
}
