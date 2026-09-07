import { useEffect, useMemo, useRef, useState } from 'react';
import { addTarget } from '../utils/cursorFx.js';

/**
 * Give an element a cursor annotation, a gravity field, or both.
 *
 * Returns a ref to put on the element. Nothing else is needed at the call
 * site — no handlers, no state — because the registry hit-tests the element's
 * own box rather than relying on mouseenter, which is what lets a canvas-drawn
 * thing and a DOM node be annotated the same way.
 *
 * It is a CALLBACK ref that also carries `.current`, so it can be read like an
 * ordinary one. That matters for a target that comes and goes with a
 * condition: a plain ref object is filled in after the effect has already run
 * and looked at it, so a conditionally rendered element registered nothing and
 * stayed dark until something unrelated re-ran the effect.
 *
 * @param {object} options
 * @param {string} [options.label] - annotation text; shown in caps.
 * @param {string} [options.icon] - key of a chip icon, e.g. `'eye'`.
 * @param {string} [options.name] - what to call this field in the debug
 *   overlay. Falls back to the label.
 * @param {() => void} [options.hold] - what a held press on this target does.
 *   The chip fills as the press runs and this fires when it completes.
 * @param {number} [options.holdMs] - how long that takes.
 * @param {number} [options.holdRing] - how wide the held-press ring grows.
 * @param {{bg: string, ink: string}} [options.tone] - chip colours.
 * @param {number|{top?:number,right?:number,bottom?:number,left?:number}}
 *   [options.gravity] - px OUTSIDE the element's box at which the cursor
 *   starts aiming at it. A number is the same reach on every side; an object
 *   sets them individually. Omit for no field.
 * @param {number} [options.releaseCore=1] - how far in from the border the
 *   pointer has to come before the aim lets go, as a fraction (1 = the moment
 *   it is over the target at all, 0.5 = halfway to the middle).
 * @param {(progress: number) => void} [options.onHold] - called each frame
 *   while a press on this target is running.
 * @param {number} [options.strength=1] - scales the pull.
 * @param {boolean} [options.releaseInside=true] - let go once the pointer is
 *   actually over the element, so it can be used normally.
 * @param {boolean} [options.enabled=true]
 */
export default function useCursorFx({
  label,
  icon,
  name,
  hold,
  holdMs,
  holdRing,
  onHold,
  tone,
  gravity,
  strength = 1,
  releaseInside = true,
  releaseCore = 1,
  enabled = true,
} = {}) {
  const [node, setNode] = useState(null);
  const ref = useMemo(() => {
    const set = el => {
      set.current = el;
      setNode(el);
    };
    set.current = null;
    return set;
  }, []);
  const toneKey = tone ? `${tone.bg}|${tone.ink}` : '';
  // Compared by value, like `tone`: a per-side reach is usually an object
  // literal, and a fresh one each render must not re-register the target.
  const gravityKey =
    gravity == null || typeof gravity === 'number'
      ? String(gravity)
      : `${gravity.top}|${gravity.right}|${gravity.bottom}|${gravity.left}`;
  // Read through a ref: a caller passing an inline arrow would otherwise
  // re-register the target on every render of its component.
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const watchRef = useRef(onHold);
  watchRef.current = onHold;

  useEffect(() => {
    const el = node;
    if (!el || !enabled) return undefined;
    if (!label && gravity == null) return undefined;
    return addTarget({
      el,
      label,
      icon,
      name,
      hold: hold ? () => holdRef.current?.() : null,
      onHold: onHold ? p => watchRef.current?.(p) : null,
      holdMs,
      holdRing,
      tone: toneKey ? { bg: tone.bg, ink: tone.ink } : null,
      gravity:
        gravity == null
          ? null
          : { distance: gravity, strength, releaseInside, releaseCore },
    });
    // `tone` is deliberately absent: it is compared by VALUE through
    // `toneKey`, so a caller passing a fresh object literal each render does
    // not re-register the target on every unrelated re-render.
    // eslint-disable-next-line
    // `hold` is compared by presence, not identity — see `holdRef`.
    // eslint-disable-next-line
  }, [
    node,
    label,
    icon,
    name,
    Boolean(hold),
    Boolean(onHold),
    holdMs,
    holdRing,
    toneKey,
    gravityKey,
    strength,
    releaseInside,
    releaseCore,
    enabled,
  ]);

  return ref;
}
