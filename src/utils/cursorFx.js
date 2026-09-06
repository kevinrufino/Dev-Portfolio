/**
 * Cursor effects: hover annotations and gravity.
 *
 * Two behaviours share one registry because they answer the same question —
 * "what is the pointer near, and what is it over?" — and asking it once per
 * frame is much cheaper than every interested component running its own
 * hit test.
 *
 * ANNOTATION. Whatever the pointer is inside names itself, and a chip
 * travelling with the cursor says what it is. The chip is deliberately
 * stepped rather than eased: it re-seats on the page's 6px lattice every
 * STEP_MS, so it walks after the cursor in visible increments instead of
 * gliding. Everything else about it — appearing, leaving, changing its mind —
 * is a smooth transition, so the jerkiness reads as a choice rather than as
 * dropped frames.
 *
 * GRAVITY. A target can also declare a distance at which it starts pulling
 * the cursor toward itself. The pull is `d * ease(t)`, where `d` is the gap to
 * the target and `t` is how far into its range the pointer has come. The ease
 * is a smoothstep, which is the whole trick: it leaves the boundary with zero
 * slope, so crossing into a field is imperceptible rather than a pop, and it
 * arrives at 1 with zero slope, so the fraction pulled reaches everything and
 * the residual gap collapses — the cursor lands ON the target instead of
 * drifting near it. Nothing is pulled from across the page: a target only
 * reaches as far as it says it does.
 *
 * Only the DRAWN cursor moves. No pointer events are synthesised and no hit
 * testing is redirected, so a pulled cursor never clicks something the reader
 * did not put their hand on.
 */

/** The page's shared lattice; the chip seats on it like everything else. */
const GRID = 6;
/** How often the chip takes a step. Long enough to see each one land. */
const STEP_MS = 70;
/** Per-frame easing on the pull, so entering a field is a lean, not a jump. */
const PULL_EASE = 0.2;
/** Chip offset from the cursor, before the lattice snap. */
const CHIP_DX = 22;
const CHIP_DY = 20;

const targets = new Set();
const sources = new Set();
const listeners = new Set();

let px = -9999;
let py = -9999;
let moved = false;
let raf = 0;
let stepAt = 0;
let chip = null;

const pull = { x: 0, y: 0 };
let pullTo = { x: 0, y: 0 };
let shown = { label: '', tone: null };

/** Gap between a point and a target's shape; zero anywhere inside it. */
const gapTo = (g, x, y) => {
  if (g.r != null) return Math.max(0, Math.hypot(x - g.x, y - g.y) - g.r);
  const dx = Math.max(g.left - x, 0, x - g.right);
  const dy = Math.max(g.top - y, 0, y - g.bottom);
  return Math.hypot(dx, dy);
};

const centreOf = g =>
  g.r != null
    ? { x: g.x, y: g.y }
    : { x: (g.left + g.right) / 2, y: (g.top + g.bottom) / 2 };

const areaOf = g =>
  g.r != null
    ? Math.PI * g.r * g.r
    : Math.max(0, g.right - g.left) * Math.max(0, g.bottom - g.top);

const geomOf = target => {
  if (!target.el) return target.geom || null;
  const el = target.el;
  if (!el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

/**
 * One pass over every registered target.
 *
 * The innermost thing under the pointer wins the label — a project row inside
 * a list inside a section should say "project", not "section" — which is what
 * comparing areas is for. Gravity goes to the nearest field instead, since
 * that is the one the reader is actually approaching.
 */
const evaluate = () => {
  let label = '';
  let tone = null;
  let smallest = Infinity;
  let nearest = Infinity;
  let want = { x: 0, y: 0 };

  const consider = (desc, geom) => {
    if (!geom) return;
    const d = gapTo(geom, px, py);

    if (d === 0 && desc.label) {
      const area = areaOf(geom);
      if (area < smallest) {
        smallest = area;
        label = desc.label;
        tone = desc.tone || null;
      }
    }

    const g = desc.gravity;
    if (!g || d >= g.distance || d >= nearest) return;
    nearest = d;
    // Inside the target the pull lets go, so the reader gets their own hand
    // back the moment they arrive — being dragged around ON something is the
    // part of a magnetic cursor that stops being helpful.
    if (d === 0 && g.releaseInside !== false) {
      want = { x: 0, y: 0 };
      return;
    }
    const c = centreOf(geom);
    const len = Math.hypot(c.x - px, c.y - py) || 1;
    const t = 1 - d / g.distance;
    const ease = t * t * (3 - 2 * t);
    const mag = d * ease * (g.strength == null ? 1 : g.strength);
    want = { x: ((c.x - px) / len) * mag, y: ((c.y - py) / len) * mag };
  };

  for (const target of targets) consider(target, geomOf(target));
  for (const source of sources) {
    const desc = source(px, py);
    if (desc) consider(desc, desc.geom);
  }

  pullTo = want;
  if (label !== shown.label || tone !== shown.tone) {
    shown = { label, tone };
    for (const listener of listeners) listener(shown);
  }
};

const loop = now => {
  raf = requestAnimationFrame(loop);

  // Targets only need re-measuring when something could have moved under the
  // pointer. Standing still costs one spring step and nothing else.
  if (moved) {
    moved = false;
    evaluate();
  }

  pull.x += (pullTo.x - pull.x) * PULL_EASE;
  pull.y += (pullTo.y - pull.y) * PULL_EASE;

  if (chip && now - stepAt >= STEP_MS) {
    stepAt = now;
    const x = Math.round((px + pull.x + CHIP_DX) / GRID) * GRID;
    const y = Math.round((py + pull.y + CHIP_DY) / GRID) * GRID;
    chip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
};

const markMoved = () => {
  moved = true;
};

const onPointerMove = event => {
  px = event.clientX;
  py = event.clientY;
  moved = true;
};

const onPointerLeave = () => {
  px = -9999;
  py = -9999;
  moved = true;
};

let started = false;

const start = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', markMoved, { passive: true });
  window.addEventListener('resize', markMoved);
  document.addEventListener('pointerleave', onPointerLeave);
  raf = requestAnimationFrame(loop);
};

const stop = () => {
  if (!started) return;
  started = false;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('scroll', markMoved);
  window.removeEventListener('resize', markMoved);
  document.removeEventListener('pointerleave', onPointerLeave);
  cancelAnimationFrame(raf);
};

const settle = () => {
  if (targets.size === 0 && sources.size === 0 && listeners.size === 0) stop();
  else start();
};

/**
 * Register a DOM element.
 *
 * @param {object} target - `{ el, label?, tone?, gravity? }`. `gravity` is
 *   `{ distance, strength?, releaseInside? }`; `distance` is measured from the
 *   element's own box, so "40px around the button" is `distance: 40`.
 * @returns {() => void} teardown.
 */
export function addTarget(target) {
  targets.add(target);
  settle();
  moved = true;
  return () => {
    targets.delete(target);
    settle();
  };
}

/**
 * Register a source of targets that have no DOM to point at — anything drawn
 * into a canvas. The function is asked, per pointer sample, what is at that
 * position, and answers with the same descriptor shape plus an explicit
 * `geom` (`{left,top,right,bottom}` or `{x,y,r}`), or null for nothing.
 *
 * @param {(x: number, y: number) => object|null} source
 * @returns {() => void} teardown.
 */
export function addSource(source) {
  sources.add(source);
  settle();
  moved = true;
  return () => {
    sources.delete(source);
    settle();
  };
}

/** Watch what the pointer is over. Fires only when the answer changes. */
export function subscribe(listener) {
  listeners.add(listener);
  settle();
  listener(shown);
  return () => {
    listeners.delete(listener);
    settle();
  };
}

/** The element the chip is drawn as, handed over by the annotation component. */
export function setChip(el) {
  chip = el;
}

/** Live pull offset, read by the drawn cursor every frame. */
export function pullOffset() {
  return pull;
}
