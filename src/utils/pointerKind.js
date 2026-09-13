/**
 * Which kind of pointer is driving the page.
 *
 * The site replaces the native cursor with a drawn one, aims it at gravity
 * fields, and trails pixels behind it. None of that exists on a touch screen —
 * there is no cursor to replace and nothing to trail — but until this existed
 * only `Cursor.js` knew that. The registry that measures every gravity field
 * and the three canvases that draw the trail all ran anyway, on every phone,
 * for an effect that could never fire.
 *
 * `(pointer: fine)` rather than a touch-capability check, deliberately: it is
 * the same query `index.css` uses to hide the native cursor, so the thing that
 * decides whether a cursor is drawn and the thing that decides whether the
 * cursor machinery runs can never disagree. A laptop with a touchscreen reports
 * a fine pointer and keeps the full experience.
 */

const QUERY = '(pointer: fine)';

/** True where there is a real cursor to replace. SSR-safe. */
export const hasFinePointer = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia(QUERY).matches;
};

/**
 * Watch for the answer changing — plugging in a mouse, or a tablet switching
 * between touch and trackpad. Returns an unsubscribe.
 */
export const onPointerKindChange = handler => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  const listener = () => handler(mq.matches);
  // Safari only grew addEventListener on MediaQueryList in 14.
  if (mq.addEventListener) mq.addEventListener('change', listener);
  else mq.addListener(listener);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', listener);
    else mq.removeListener(listener);
  };
};
