import { useEffect, useMemo, useRef } from 'react';

// 18px cells = three of the page's 6px grid cells, so a trail cell always
// lands on the lattice the sections and the palm share.
const TRAIL = {
  pixelSize: 18,
  gap: 0,
  maxOpacity: 0.82,
  attackDuration: 32,
  holdDuration: 200,
  fadeDuration: 800,
  velocityInfluence: 0.2,
  sampleSpacing: 0.62,
  blur: 8,
  alphaGain: 19,
  alphaOffset: -9,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The path the trail was painted along, published for anything that wants to
// walk it rather than cut across it. `oneko` is the one consumer: the cat
// chases the trail instead of the pointer, so it retraces the route the
// reader's hand actually took.
//
// A plain global rather than a React value on purpose — the cat is a vendored
// script in `public/`, outside the bundle, and this is the only surface the
// two share. Points carry a document-space y so they stay put under the
// content while the page scrolls, and a monotonic id so a follower can keep
// its place without owning the array.
const TRAIL_PATH_MAX = 96;

const publishTrailPoint = (x, y) => {
  const trail = (window.__pixelTrail ??= { points: [], nextId: 0 });
  trail.points.push({
    id: trail.nextId++,
    x,
    docY: y + window.scrollY,
    at: performance.now(),
  });
  if (trail.points.length > TRAIL_PATH_MAX) {
    trail.points.splice(0, trail.points.length - TRAIL_PATH_MAX);
  }
};

// Ink per ground: ultra over the acid hero and the paper intro, gold over the
// charcoal footer. Over the projects section — the one surface with no grid —
// the trail doesn't paint at all, so it never fights the index's own type.
//
// Canvas fillStyle does not resolve CSS custom properties, so the tokens are
// read into real values once per resize rather than per cell (getComputedStyle
// is a layout read, and a fast pointer paints up to 24 cells per event).
const INK_FALLBACK = { ultra: '#3e3bf4', gold: '#ebc035' };

const readToken = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  fallback;

// Which ground is actually under the pointer.
//
// Deliberately a hit-test rather than a rect comparison. The footer is fixed
// behind the page and uncovered by scrolling, so its rect says it is at the
// bottom of the viewport at ALL times — comparing against it painted footer
// gold across the lower half of every section. Asking what is really under the
// cursor is correct whether the footer is revealed, covered, or in flow.
//
// Both overlays are pointer-events: none, so this returns page content, never
// the trail canvas or the cursor.
const inkUnder = (x, y, ctx) => {
  const el = document.elementFromPoint(x, y);
  if (!el) return ctx.ultra;
  if (ctx.footer?.contains(el)) return ctx.gold;
  if (ctx.works?.contains(el)) return null;
  return ctx.ultra;
};

/**
 * The trail engine, shared by every canvas that draws it.
 *
 * One set of cells, one pointer listener, one frame loop — and any number of
 * surfaces painting the same thing. That indirection exists for one reason:
 * the trail has to sit BEHIND the page's text, and "behind the text" is a
 * different place in three different stacking contexts. The hero and the
 * intro live inside the opaque content wrapper; the footer is fixed behind
 * that wrapper with a stacking context of its own that nothing outside it can
 * reach into. A single overlay can be above everything or below everything,
 * and neither is what this wants.
 */
const engine = {
  cells: new Map(),
  surfaces: new Set(),
  ink: { ...INK_FALLBACK },
  size: { width: 0, height: 0, dpr: 1 },
  lastPointer: null,
  reduced: false,
  raf: 0,
  bound: false,
};

const pitch = () => TRAIL.pixelSize + TRAIL.gap;

const sizeSurface = surface => {
  const { width, height, dpr } = engine.size;
  const { canvas, ctx } = surface;
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const resize = () => {
  engine.size = {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  };
  // Re-resolved here so a token change (or a theme swap) is picked up, and the
  // section lookups survive route changes that remount the page.
  engine.ink = {
    ultra: readToken('--ultra', INK_FALLBACK.ultra),
    gold: readToken('--palm-gold', INK_FALLBACK.gold),
    works: document.getElementById('projects'),
    footer: document.getElementById('contact'),
  };
  engine.surfaces.forEach(sizeSurface);
};

const draw = now => {
  const total =
    TRAIL.attackDuration + TRAIL.holdDuration + TRAIL.fadeDuration;
  const { width, height } = engine.size;
  const p = pitch();
  const scroll = window.scrollY;

  for (const { ctx } of engine.surfaces) ctx.clearRect(0, 0, width, height);

  for (const [key, cell] of engine.cells) {
    const age = now - cell.startedAt;
    if (age >= total) {
      engine.cells.delete(key);
      continue;
    }
    const attack = clamp(age / TRAIL.attackDuration, 0, 1);
    const fadeAge = age - TRAIL.attackDuration - TRAIL.holdDuration;
    const fade = fadeAge <= 0 ? 0 : clamp(fadeAge / TRAIL.fadeDuration, 0, 1);
    const boosted = clamp(
      1 + cell.velocity * TRAIL.velocityInfluence * 0.08,
      0,
      1,
    );
    const opacity = TRAIL.maxOpacity * boosted * attack * (1 - fade);
    if (opacity <= 0) continue;

    // Rows are document-space, so subtract the scroll to place the cell.
    const x = cell.column * p;
    const y = cell.row * p - scroll;
    for (const { ctx } of engine.surfaces) {
      ctx.globalAlpha = opacity;
      ctx.fillStyle = cell.color;
      ctx.fillRect(x, y, TRAIL.pixelSize, TRAIL.pixelSize);
    }
  }

  for (const { ctx } of engine.surfaces) ctx.globalAlpha = 1;
  engine.raf = engine.cells.size > 0 ? requestAnimationFrame(draw) : 0;
};

const scheduleDraw = () => {
  if (engine.raf === 0) engine.raf = requestAnimationFrame(draw);
};

const paintAt = (clientX, clientY, velocity, color) => {
  if (engine.reduced || !color) return;
  const { width, height } = engine.size;
  if (clientX < 0 || clientX > width || clientY < 0 || clientY > height) return;
  const p = pitch();
  const column = Math.floor(clientX / p);
  // Document-space row: the cell belongs to the page, not the viewport, so it
  // stays under the same content while the page scrolls beneath it.
  const row = Math.floor((clientY + window.scrollY) / p);
  engine.cells.set(`${column}:${row}`, {
    column,
    row,
    velocity,
    color,
    startedAt: performance.now(),
  });
  scheduleDraw();
};

const handlePointer = event => {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

  const now = performance.now();
  const previous = engine.lastPointer;
  const velocity = previous
    ? clamp(
        Math.hypot(event.clientX - previous.x, event.clientY - previous.y) /
          (now - previous.time + 1),
        0,
        4,
      )
    : 0;

  // One hit-test per event, not per interpolated cell: the sampled path is
  // short enough that its two ends are always on the same ground.
  const color = inkUnder(event.clientX, event.clientY, engine.ink);
  publishTrailPoint(event.clientX, event.clientY);

  if (previous) {
    const distance = Math.hypot(
      event.clientX - previous.x,
      event.clientY - previous.y,
    );
    const spacing = Math.max(1, TRAIL.sampleSpacing * pitch());
    const steps = clamp(Math.ceil(distance / spacing), 1, 24);
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      paintAt(
        previous.x + (event.clientX - previous.x) * t,
        previous.y + (event.clientY - previous.y) * t,
        velocity,
        color,
      );
    }
  } else {
    paintAt(event.clientX, event.clientY, velocity, color);
  }

  engine.lastPointer = { x: event.clientX, y: event.clientY, time: now };
};

// Live cells have to be redrawn while scrolling, since their rows are anchored
// to the document rather than the viewport.
const onScroll = () => {
  if (engine.cells.size > 0) scheduleDraw();
};

let motionQuery = null;
const syncMotion = () => {
  engine.reduced = motionQuery.matches;
  if (engine.reduced) {
    engine.cells.clear();
    scheduleDraw();
  }
};

const bind = () => {
  if (engine.bound) return;
  engine.bound = true;
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  resize();
  syncMotion();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', handlePointer, { passive: true });
  window.addEventListener('pointerdown', handlePointer, { passive: true });
  motionQuery.addEventListener('change', syncMotion);
};

const unbind = () => {
  if (!engine.bound) return;
  engine.bound = false;
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', resize);
  window.removeEventListener('pointermove', handlePointer);
  window.removeEventListener('pointerdown', handlePointer);
  motionQuery?.removeEventListener('change', syncMotion);
  cancelAnimationFrame(engine.raf);
  engine.raf = 0;
  engine.cells.clear();
  engine.lastPointer = null;
  // The path outlives this component otherwise, and the cat would spend its
  // first seconds on the next route walking a route from the last one.
  if (window.__pixelTrail) window.__pixelTrail.points.length = 0;
};

const GooeyFilter = ({ id }) => (
  <svg className='gooey-defs' aria-hidden='true' focusable='false'>
    <defs>
      <filter id={id} colorInterpolationFilters='sRGB'>
        <feGaussianBlur
          in='SourceGraphic'
          stdDeviation={TRAIL.blur}
          result='blur'
        />
        <feColorMatrix
          in='blur'
          type='matrix'
          values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${TRAIL.alphaGain} ${TRAIL.alphaOffset}`}
          result='goo'
        />
        <feComposite in='SourceGraphic' in2='goo' operator='atop' />
      </filter>
    </defs>
  </svg>
);

/**
 * One surface the trail is drawn on.
 *
 * Mounted more than once, in the stacking context of each ground it has to
 * appear on, so it can sit under that ground's text instead of over it. All
 * of them draw the same cells from the same engine.
 *
 * @param {string} [className] - extra classes on the wrapper; this is where
 *   the layer's z-index and clipping come from.
 */
const PixelTrail = ({ className = '' }) => {
  const canvasRef = useRef(null);
  const filterId = useMemo(
    () => `portfolio-pixel-trail-${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const surface = { canvas, ctx: canvas.getContext('2d', { alpha: true }) };
    bind();
    engine.surfaces.add(surface);
    sizeSurface(surface);
    return () => {
      engine.surfaces.delete(surface);
      if (engine.surfaces.size === 0) unbind();
    };
  }, []);

  return (
    <div className={`portfolio-pixel-trail ${className}`.trim()}>
      <GooeyFilter id={filterId} />
      <canvas
        ref={canvasRef}
        className='portfolio-pixel-trail__canvas'
        style={{ filter: `url(#${filterId})` }}
      />
    </div>
  );
};

export default PixelTrail;
