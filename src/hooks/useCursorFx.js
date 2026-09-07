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
 * @param {string} [options.icon] - key of a chip icon, e.g. `'eye'`.
 * @param {string} [options.name] - what to call this field in the debug
 *   overlay. Falls back to the label.
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
  icon,
  name,
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
      icon,
      name,
      tone: toneKey ? { bg: tone.bg, ink: tone.ink } : null,
      gravity:
        gravity == null ? null : { distance: gravity, strength, releaseInside },
    });
    // `tone` is deliberately absent: it is compared by VALUE through
    // `toneKey`, so a caller passing a fresh object literal each render does
    // not re-register the target on every unrelated re-render.
    // eslint-disable-next-line
  }, [label, icon, name, toneKey, gravity, strength, releaseInside, enabled]);

  return ref;
}
