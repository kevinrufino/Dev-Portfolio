/**
 * Cursor effects: hover annotations and gravity.
 *
 * Two behaviours share one registry because they answer the same question —
 * "what is the pointer near, and what is it over?" — and asking it once per
 * frame is much cheaper than every interested component running its own
 * hit test.
 *
 * ANNOTATION. Whatever the pointer is inside names itself, and a chip
 * travelling with the cursor says what it is. The chip is written straight
 * from the pointer event, at the pointer's exact position, so it moves with
 * the cursor rather than after it. Only the states around it — appearing,
 * leaving, changing its mind — are eased.
 *
 * GRAVITY. Nothing is dragged. A target declares a distance at which it
 * starts to AIM the cursor: anywhere inside that field the drawn arrow points
 * AT the target — the whole way, like a compass needle, not a fraction of the
 * way — and keeps pointing at it from wherever the reader's hand happens to
 * be. The cursor never leaves the position the hand put it in, so nothing is
 * ever clicked that the reader did not aim at themselves.
 *
 * The ease is in TIME, not in distance. Blending the angle by how deep into
 * the field the pointer had come sounded softer and was in fact the bug: full
 * aim then required a weight of 1, which only happened at zero distance —
 * where the field lets go — so the needle never actually pointed at anything.
 * It is binary now, in or out, and the turn itself is eased over a few frames.
 *
 * A target reaches exactly as far as it says it does and no further, and it
 * is ignored while something else is drawn over it. The reach can differ per
 * side — `{top, right, bottom, left}` — for a control that should be findable
 * from one direction more than another; the field is then an ellipse-cornered
 * box rather than a rounded one, because each axis is normalised by its own
 * side before the two are combined.
 *
 * Letting go is a choice too. By default a target releases the moment the
 * pointer is over it, which hands back an ordinary cursor for the thing the
 * reader has arrived at. A large target can instead keep pointing until the
 * pointer reaches its core (`releaseCore`, as a fraction of the way in from
 * the border), which is what a big canvas wants: the edge of it is still a
 * place you are heading toward, not a place you have arrived.
 */

/** Chip offset from the pointer. */
const CHIP_DX = 20;
const CHIP_DY = 18;
/** Per-frame easing on the aim, so entering a field is a turn, not a snap. */
const AIM_EASE = 0.22;
/** How long a press has to be held before it counts. */
const HOLD_MS = 620;

const targets = new Set();
const sources = new Set();
const listeners = new Set();
// Sources are asked what is at a point, which is no use to anything that
// wants to draw every field at once. A source may register a second function
// that lists them; the debug overlay is the only caller.
const enumerators = new Map();

let px = -9999;
let py = -9999;
let moved = false;
let raf = 0;
let chip = null;

/** Where the arrow is pointing, and how much of that is the field's doing. */
const aim = { angle: 0, weight: 0 };
let aimTo = { angle: 0, weight: 0 };
let shown = { label: '', tone: null, icon: null };
// The action the thing under the pointer offers on a held press, and the press
// itself. Kept out of `shown` because it is a function: its identity changes on
// every render of the component that supplies it, and the listeners fire on a
// change of subject, not on a re-render.
let holdAction = null;
let holdWatch = null;
let holdMs = HOLD_MS;
let heldFrom = 0;

/** Gap between a point and a target's shape, in px; zero anywhere inside it. */
const gapTo = (g, x, y) => {
  if (g.r != null) return Math.max(0, Math.hypot(x - g.x, y - g.y) - g.r);
  const dx = Math.max(g.left - x, 0, x - g.right);
  const dy = Math.max(g.top - y, 0, y - g.bottom);
  return Math.hypot(dx, dy);
};

/** A reach, as four sides. A plain number is the same reach on all of them. */
export const sidesOf = distance =>
  typeof distance === 'number'
    ? { top: distance, right: distance, bottom: distance, left: distance }
    : {
        top: distance.top ?? 0,
        right: distance.right ?? 0,
        bottom: distance.bottom ?? 0,
        left: distance.left ?? 0,
      };

/**
 * How far into the field the pointer has come, as a fraction: 0 at the
 * boundary, 1 at the target's own edge, more than 1 inside it.
 *
 * Each axis is divided by the reach on the side it is approaching from, so a
 * target that reaches twice as far to its right is exactly twice as easy to
 * find from the right and no easier from anywhere else.
 */
const reachInto = (g, sides, x, y) => {
  const dx =
    Math.max(0, (g.r != null ? g.x - g.r : g.left) - x) / (sides.left || 1e-6) +
    Math.max(0, x - (g.r != null ? g.x + g.r : g.right)) / (sides.right || 1e-6);
  const dy =
    Math.max(0, (g.r != null ? g.y - g.r : g.top) - y) / (sides.top || 1e-6) +
    Math.max(0, y - (g.r != null ? g.y + g.r : g.bottom)) /
      (sides.bottom || 1e-6);
  return 1 - Math.hypot(dx, dy);
};

/**
 * Where the pointer is inside a target: 0 on its border, 1 at its centre.
 * Chebyshev for a box and radial for a circle, so the contour matches the
 * shape rather than cutting its corners.
 */
const coreDepth = (g, x, y) => {
  if (g.r != null) return 1 - Math.min(1, Math.hypot(x - g.x, y - g.y) / g.r);
  const halfW = (g.right - g.left) / 2 || 1;
  const halfH = (g.bottom - g.top) / 2 || 1;
  const nx = Math.abs(x - (g.left + g.right) / 2) / halfW;
  const ny = Math.abs(y - (g.top + g.bottom) / 2) / halfH;
  return 1 - Math.min(1, Math.max(nx, ny));
};

const centreOf = g =>
  g.r != null
    ? { x: g.x, y: g.y }
    : { x: (g.left + g.right) / 2, y: (g.top + g.bottom) / 2 };

const areaOf = g =>
  g.r != null
    ? Math.PI * g.r * g.r
    : Math.max(0, g.right - g.left) * Math.max(0, g.bottom - g.top);

/**
 * Is anything drawn on top of this element where it sits?
 *
 * The intro is sticky, so it stays in the document — and in this registry —
 * behind the works section that rides up over it. Its fields were still live
 * under an opaque pane, aiming the cursor at things the reader could not see
 * or reach. Asking what is actually on top at the element's own middle is the
 * same test the trail and the cat use, and it is correct whether the thing in
 * the way is a section, a dialog, or the page's own footer.
 */
const covered = (el, geom) => {
  const x = Math.min(window.innerWidth - 1, Math.max(1, (geom.left + geom.right) / 2));
  const y = Math.min(window.innerHeight - 1, Math.max(1, (geom.top + geom.bottom) / 2));
  const top = document.elementFromPoint(x, y);
  if (!top) return true;
  return !(top === el || el.contains(top) || top.contains(el));
};

const geomOf = target => {
  if (!target.el) return target.geom || null;
  const el = target.el;
  if (!el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const geom = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  if (r.bottom < 0 || r.top > window.innerHeight) return null;
  return covered(el, geom) ? null : geom;
};

/** Shortest way round from one angle to another, in radians. */
const shortest = (from, to) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/**
 * One pass over every registered target.
 *
 * The innermost thing under the pointer wins the label — a project row inside
 * a list inside a section should say "project", not "section" — which is what
 * comparing areas is for. The aim goes to the nearest field instead, since
 * that is the one the reader is actually approaching.
 */
const evaluate = () => {
  let label = '';
  let tone = null;
  let icon = null;
  let action = null;
  let actionWatch = null;
  let actionMs = HOLD_MS;
  let smallest = Infinity;
  let nearest = Infinity;
  let want = { angle: aim.angle, weight: 0 };

  const consider = (desc, geom) => {
    if (!geom) return;
    const d = gapTo(geom, px, py);

    if (d === 0 && desc.label) {
      const area = areaOf(geom);
      if (area < smallest) {
        smallest = area;
        label = desc.label;
        tone = desc.tone || null;
        icon = desc.icon || null;
        action = desc.hold || null;
        actionWatch = desc.onHold || null;
        actionMs = desc.holdMs || HOLD_MS;
      }
    }

    const g = desc.gravity;
    if (!g) return;
    const sides = sidesOf(g.distance);
    if (reachInto(geom, sides, px, py) <= 0 || d >= nearest) return;
    nearest = d;
    // Standing on the thing, the needle lets go — being aimed at something the
    // pointer is already inside says nothing, and it takes the ordinary cursor
    // away from the one place the reader needs it. A target with a `releaseCore`
    // holds on further, until the pointer is that far in from its border.
    const core = g.releaseCore == null ? 1 : g.releaseCore;
    if (
      d === 0 &&
      g.releaseInside !== false &&
      coreDepth(geom, px, py) >= core
    ) {
      want = { angle: aim.angle, weight: 0 };
      return;
    }
    const c = centreOf(geom);
    want = {
      angle: Math.atan2(c.y - py, c.x - px),
      // Full aim. `strength` is here for a target that wants to be pointed at
      // only partly; it is not a distance ramp.
      weight: g.strength == null ? 1 : g.strength,
    };
  };

  for (const target of targets) consider(target, geomOf(target));
  for (const source of sources) {
    const desc = source(px, py);
    if (desc) consider(desc, desc.geom);
  }

  aimTo = want;
  // Moving off the thing abandons the press. A hold is a commitment to one
  // target, not a stopwatch that keeps running wherever the hand goes.
  if (action !== holdAction) releaseHold();
  holdAction = action;
  holdWatch = actionWatch;
  holdMs = actionMs;
  if (label !== shown.label || tone !== shown.tone || icon !== shown.icon) {
    shown = { label, tone, icon };
    for (const listener of listeners) listener(shown);
  }
};

const setHoldProgress = value => {
  if (chip) chip.style.setProperty('--hold', String(value));
};

function releaseHold() {
  if (!heldFrom) return;
  heldFrom = 0;
  setHoldProgress(0);
  holdWatch?.(0);
}

const loop = () => {
  raf = requestAnimationFrame(loop);

  // Targets only need re-measuring when something could have moved under the
  // pointer. Standing still costs one easing step and nothing else.
  if (moved) {
    moved = false;
    evaluate();
  }

  aim.angle += shortest(aim.angle, aimTo.angle) * AIM_EASE;
  aim.weight += (aimTo.weight - aim.weight) * AIM_EASE;

  if (heldFrom) {
    const progress = Math.min(1, (performance.now() - heldFrom) / holdMs);
    setHoldProgress(progress);
    holdWatch?.(progress);
    if (progress >= 1) {
      const run = holdAction;
      releaseHold();
      run?.();
    }
  }
};

const markMoved = () => {
  moved = true;
};

const placeChip = () => {
  if (!chip) return;
  chip.style.transform = `translate3d(${px + CHIP_DX}px, ${py + CHIP_DY}px, 0)`;
};

const onPointerMove = event => {
  px = event.clientX;
  py = event.clientY;
  moved = true;
  // Written here rather than on the frame loop: the chip has to land on the
  // same frame as the pointer, or it reads as lagging however small the gap.
  placeChip();
};

const onPointerLeave = () => {
  px = -9999;
  py = -9999;
  moved = true;
  releaseHold();
};

const onPointerDown = event => {
  if (event.button !== 0 || !holdAction) return;
  heldFrom = performance.now();
  setHoldProgress(0);
  holdWatch?.(0.0001);
};

const onPointerUp = () => releaseHold();

let started = false;

const start = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  window.addEventListener('scroll', markMoved, { passive: true });
  window.addEventListener('resize', markMoved);
  document.addEventListener('pointerleave', onPointerLeave);
  raf = requestAnimationFrame(loop);
};

const stop = () => {
  if (!started) return;
  started = false;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerdown', onPointerDown);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
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
 *   element's own box, so "aim from 40px around the button" is `distance: 40`.
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
 * @param {() => object[]} [enumerate] - every descriptor this source can
 *   produce right now, for the debug overlay. Optional.
 * @returns {() => void} teardown.
 */
export function addSource(source, enumerate) {
  sources.add(source);
  if (enumerate) enumerators.set(source, enumerate);
  settle();
  moved = true;
  return () => {
    sources.delete(source);
    enumerators.delete(source);
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

/**
 * Every gravity field on the page right now, in client coordinates.
 *
 * For the overlay that draws them: a field is invisible by nature, and the
 * only way to say "this one should reach further" is to be able to see where
 * it currently stops.
 *
 * @returns {{name: string, geom: object, distance: number, strength: number}[]}
 */
export function debugFields() {
  const out = [];
  const push = (desc, geom) => {
    if (!geom || !desc.gravity) return;
    out.push({
      name: desc.name || desc.label || 'field',
      geom,
      sides: sidesOf(desc.gravity.distance),
      core: desc.gravity.releaseCore == null ? 1 : desc.gravity.releaseCore,
      strength: desc.gravity.strength == null ? 1 : desc.gravity.strength,
    });
  };
  for (const target of targets) push(target, geomOf(target));
  for (const enumerate of enumerators.values()) {
    let list = [];
    try {
      list = enumerate() || [];
    } catch {
      list = [];
    }
    for (const desc of list) push(desc, desc.geom);
  }
  return out;
}

/** The element the chip is drawn as, handed over by the annotation component. */
export function setChip(el) {
  chip = el;
  placeChip();
  setHoldProgress(0);
}

/**
 * Where the drawn cursor should be pointing, and how strongly.
 *
 * `weight` is 0 with nothing in range and 1 deep inside a field; the caller
 * blends between its own resting direction and `angle` by that much.
 */
export function aimState() {
  return aim;
}
