/**
 * The curtain between routes — a blind sweep, run by the browser.
 *
 * Same look as before: diagonal bands at the palm-frond angle, each a beat
 * late, carry an acid field across the outgoing page on a 12px lattice with a
 * Bayer-dithered front; the document swaps underneath; then the field is
 * taken apart from the opposite corner.
 *
 * What changed is who draws it. It used to be a canvas that JavaScript
 * repainted cell by cell every frame, held on screen by framer-motion's
 * AnimatePresence until it had covered the page. Now it is a View Transition:
 * the browser snapshots the outgoing page, the route swaps inside
 * `startViewTransition`, and the sweep is two CSS mask animations on the
 * `::view-transition-old(root)` / `::view-transition-new(root)` snapshots over
 * an acid `::view-transition` ground. No script runs per frame.
 *
 * HOW THE DITHER SURVIVES BEING CSS. A mask cannot threshold, so the dithered
 * front cannot be computed live. It is baked instead: one image per half,
 * one pixel per 12px cell, holding the finished front — bands, jitter and
 * Bayer pattern included — and the animation slides that image diagonally a
 * whole cell at a time. Sliding along the diagonal leaves `x - y` unchanged,
 * which is the axis the bands are struck on, so each band keeps its own delay
 * exactly as the canvas version did. `image-rendering: pixelated` keeps the
 * 12x upscale hard-edged, and a stepped keyframe per cell keeps every cell on
 * the viewport's 12px lattice rather than gliding between positions.
 *
 * The masks and keyframes depend only on the viewport size in cells, so they
 * are built once per size and reused.
 *
 * Where View Transitions are not supported, or the reader prefers reduced
 * motion, the route simply swaps — as the canvas curtain did under reduced
 * motion.
 */

const CELL = 12;
// Build, pause, take apart. The pause is what makes it a handover rather than
// a wipe: for a beat the reader is looking at neither page.
const BUILD_MS = 640;
const HOLD_MS = 120;
const LIFT_MS = 820;
// Cells per blind, and how far the front is feathered.
const BAND = 5;
const FEATHER = 3;
// How much of the sweep is spent on the stagger. The exit is looser than the
// entrance, so the page comes back in a less orderly way than it left.
const STAGGER_IN = 0.13;
const STAGGER_OUT = 0.16;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** Deterministic per-band jitter; the same band is always the same beat late. */
const hash = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Inverse of smoothstep: the time at which the eased sweep reaches `y`. */
const unease = y => 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3);

const STYLE_ID = 'route-curtain-frames';
const ACTIVE_ATTR = 'data-route-curtain';

// The viewport size, in cells, the current masks were baked for.
let builtFor = '';

/**
 * Bake one half of the sweep into a cell-per-pixel PNG.
 *
 * A cell is "swept" when the front, delayed by its band's jitter, has passed
 * it — fully past the feather, or inside it and above its Bayer threshold.
 * The cover image keeps the UNswept cells (the outgoing page shows only where
 * the acid has not reached yet); the lift image keeps the swept ones, flipped,
 * so it grows from the far corner.
 */
const bakeMask = ({ wc, hc, kc, stagger, seed, keepSwept }) => {
  const canvas = document.createElement('canvas');
  canvas.width = wc;
  canvas.height = hc;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(wc, hc);
  const d = image.data;
  for (let j = 0; j < hc; j++) {
    for (let i = 0; i < wc; i++) {
      const late = hash(Math.floor((i - j) / BAND), seed) * stagger;
      const t = (kc - late - (i + j)) / FEATHER;
      const swept = t >= 1 || (t > 0 && t >= bayer(i, j));
      if (swept !== keepSwept) continue;
      // The lift image is written flipped, so its origin is the far corner.
      const x = keepSwept ? wc - 1 - i : i;
      const y = keepSwept ? hc - 1 - j : j;
      d[(y * wc + x) * 4 + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * One keyframe per cell of travel, each held until the next (`steps(1)`),
 * placed in time by the inverse of the sweep's ease — so the front moves on
 * the lattice and still accelerates and settles like the canvas version.
 */
const steppedFrames = (name, steps, position) => {
  let css = `@keyframes ${name}{`;
  for (let k = 0; k <= steps; k++) {
    const pct = (unease(k / steps) * 100).toFixed(3);
    css += `${pct}%{mask-position:${position(k)}}`;
  }
  return `${css}}`;
};

/**
 * Masks + keyframes for the current viewport, built on first use and again
 * only when the viewport's size in cells changes.
 */
const prepare = () => {
  const vw = Math.max(1, Math.ceil(window.innerWidth / CELL));
  const vh = Math.max(1, Math.ceil(window.innerHeight / CELL));
  const key = `${vw}x${vh}`;
  if (builtFor === key) return;

  const lateMax = Math.ceil(Math.max(STAGGER_IN, STAGGER_OUT) * (vw + vh));
  // Where the front sits in the image, and how far the image has to travel
  // for it to start wholly before the viewport's near corner and finish
  // wholly past its far one, jitter and feather included.
  const kc = vw + vh + FEATHER + lateMax + 1;
  const travel = Math.ceil((kc + FEATHER) / 2) + 1;
  const wc = vw + travel;
  const hc = vh + travel;

  const cover = bakeMask({
    wc,
    hc,
    kc,
    stagger: STAGGER_IN * (vw + vh),
    seed: 3,
    keepSwept: false,
  });
  const lift = bakeMask({
    wc,
    hc,
    kc,
    stagger: STAGGER_OUT * (vw + vh),
    seed: 11,
    keepSwept: true,
  });

  const px = n => `${n * CELL}px`;
  const css =
    `:root{--route-curtain-cover:url(${cover});` +
    `--route-curtain-lift:url(${lift});` +
    `--route-curtain-size:${px(wc)} ${px(hc)}}` +
    // Cover: the image starts a full travel up and left, so the viewport sees
    // only unswept cells, and slides home.
    steppedFrames(
      'route-curtain-cover',
      travel,
      k => `${px(k - travel)} ${px(k - travel)}`,
    ) +
    // Lift: the flipped image starts at the origin, where the viewport sees
    // none of its swept cells, and slides a full travel up and left.
    steppedFrames('route-curtain-lift', travel, k => `${px(-k)} ${px(-k)}`);

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
  builtFor = key;
};

const reduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const supportsRouteTransition = () =>
  typeof document !== 'undefined' &&
  typeof document.startViewTransition === 'function';

/** Total run time of the sweep, for anything that wants to wait it out. */
export const ROUTE_TRANSITION_MS = BUILD_MS + HOLD_MS + LIFT_MS;

/** Durations as CSS custom properties, so the stylesheet owns no numbers. */
const TIMING_CSS = {
  '--route-curtain-build-ms': `${BUILD_MS}ms`,
  '--route-curtain-hold-ms': `${HOLD_MS}ms`,
  '--route-curtain-lift-ms': `${LIFT_MS}ms`,
};

/**
 * Swap routes under the curtain.
 *
 * `update` must apply the new route synchronously (the router passes a
 * `flushSync`), because the browser captures the incoming page the moment it
 * returns. Falls back to calling it directly.
 *
 * @param {() => void} update
 * @returns {Promise<void>} settled when the sweep has finished (or at once).
 */
export function runRouteTransition(update) {
  if (!supportsRouteTransition() || reduced()) {
    update();
    return Promise.resolve();
  }
  prepare();
  const root = document.documentElement;
  // Scoped by attribute, so the curtain styles never apply to a view
  // transition something else on the page might start.
  root.setAttribute(ACTIVE_ATTR, '');
  for (const [name, value] of Object.entries(TIMING_CSS)) {
    root.style.setProperty(name, value);
  }
  const transition = document.startViewTransition(update);
  const clear = () => root.removeAttribute(ACTIVE_ATTR);
  return transition.finished.then(clear, clear);
}

/** Build the masks ahead of the first navigation, off the critical path. */
export function warmRouteTransition() {
  if (!supportsRouteTransition() || reduced()) return;
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
  idle(() => prepare());
}
