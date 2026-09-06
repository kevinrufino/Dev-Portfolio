import { useEffect, useRef } from 'react';
import { addTarget } from '../utils/cursorFx.js';

/**
 * Give an element a cursor annotation, a gravity field, or both.
 *
 * Returns a ref to put on the element. Nothing else is needed at the call
 * site — no handlers, no state — because the registry hit-tests the element's
 * own box rather than relying on mouseenter, which is what lets a canvas-drawn
 * thing and a DOM node be annotated the same way.
 *
 * @param {object} options
 * @param {string} [options.label] - annotation text; shown in caps.
 * @param {{bg: string, ink: string}} [options.tone] - chip colours.
 * @param {number} [options.gravity] - px OUTSIDE the element's box at which
 *   the cursor starts being pulled toward it. Omit for no pull.
 * @param {number} [options.strength=1] - scales the pull.
 * @param {boolean} [options.releaseInside=true] - let go once the pointer is
 *   actually over the element, so it can be used normally.
 * @param {boolean} [options.enabled=true]
 */
export default function useCursorFx({
  label,
  tone,
  gravity,
  strength = 1,
  releaseInside = true,
  enabled = true,
} = {}) {
  const ref = useRef(null);
  const toneKey = tone ? `${tone.bg}|${tone.ink}` : '';

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    if (!label && gravity == null) return undefined;
    return addTarget({
      el,
      label,
      tone: toneKey ? { bg: tone.bg, ink: tone.ink } : null,
      gravity:
        gravity == null ? null : { distance: gravity, strength, releaseInside },
    });
    // `tone` is deliberately absent: it is compared by VALUE through
    // `toneKey`, so a caller passing a fresh object literal each render does
    // not re-register the target on every unrelated re-render.
    // eslint-disable-next-line
  }, [label, toneKey, gravity, strength, releaseInside, enabled]);

  return ref;
}
