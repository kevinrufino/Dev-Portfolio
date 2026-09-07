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
 * starts to AIM the cursor: inside that field the drawn arrow turns to point
 * at the target, the way a compass needle does, and it keeps pointing at it
 * from wherever the reader's hand happens to be. The cursor never leaves the
 * position the hand put it in — only the direction it points changes — so
 * nothing is ever clicked that the reader did not aim at themselves. A target
 * reaches exactly as far as it says it does and no further, and by default
 * it lets go once the pointer is actually over it, which hands the reader
 * back an ordinary cursor for the thing they have arrived at.
 */

/** Chip offset from the pointer. */
const CHIP_DX = 20;
const CHIP_DY = 18;
/** Per-frame easing on the aim, so entering a field is a turn, not a snap. */
const AIM_EASE = 0.22;

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
      }
    }

    const g = desc.gravity;
    if (!g || d >= g.distance || d >= nearest) return;
    nearest = d;
    // Standing on the thing, the needle lets go. Being aimed at something the
    // pointer is already inside says nothing, and it takes the ordinary
    // cursor away from the one place the reader needs it.
    if (d === 0 && g.releaseInside !== false) {
      want = { angle: aim.angle, weight: 0 };
      return;
    }
    const c = centreOf(geom);
    const t = 1 - d / g.distance;
    want = {
      angle: Math.atan2(c.y - py, c.x - px),
      // Smoothstep, so the needle picks the target up as the pointer enters
      // the field rather than snapping to it at the boundary.
      weight: t * t * (3 - 2 * t) * (g.strength == null ? 1 : g.strength),
    };
  };

  for (const target of targets) consider(target, geomOf(target));
  for (const source of sources) {
    const desc = source(px, py);
    if (desc) consider(desc, desc.geom);
  }

  aimTo = want;
  if (label !== shown.label || tone !== shown.tone || icon !== shown.icon) {
    shown = { label, tone, icon };
    for (const listener of listeners) listener(shown);
  }
};

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
      distance: desc.gravity.distance,
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
