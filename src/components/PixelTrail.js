import { useEffect, useMemo, useRef } from 'react';

// 18px cells = three of the page's 6px grid cells, so a trail cell always
// lands on the lattice the sections and (later) the palm share.
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

const inkAt = (clientY, ctx) => {
  const footer = ctx.footer?.getBoundingClientRect();
  if (footer && clientY >= footer.top) return ctx.gold;
  const works = ctx.works?.getBoundingClientRect();
  if (works && clientY >= works.top && clientY < works.bottom) return null;
  return ctx.ultra;
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

const PixelTrail = () => {
  const canvasRef = useRef(null);
  const activeCellsRef = useRef(new Map());
  const rafRef = useRef(0);
  const lastPointerRef = useRef(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const reducedMotionRef = useRef(false);
  const inkRef = useRef({ ...INK_FALLBACK });
  const filterId = useMemo(
    () => `portfolio-pixel-trail-${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    const pitch = TRAIL.pixelSize + TRAIL.gap;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      sizeRef.current = { width, height, dpr };
      // Re-resolved here so a token change (or a theme swap) is picked up, and
      // the section lookups survive route changes that remount the page.
      inkRef.current = {
        ultra: readToken('--ultra', INK_FALLBACK.ultra),
        gold: readToken('--palm-gold', INK_FALLBACK.gold),
        works: document.getElementById('projects'),
        footer: document.getElementById('contact'),
      };
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const clearCanvas = () => {
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);
    };

    const draw = now => {
      const cells = activeCellsRef.current;
      const totalDuration =
        TRAIL.attackDuration + TRAIL.holdDuration + TRAIL.fadeDuration;

      clearCanvas();

      for (const [key, cell] of cells) {
        const age = now - cell.startedAt;
        if (age >= totalDuration) {
          cells.delete(key);
          continue;
        }

        const attackProgress = clamp(age / TRAIL.attackDuration, 0, 1);
        const fadeAge = age - TRAIL.attackDuration - TRAIL.holdDuration;
        const fadeProgress =
          fadeAge <= 0 ? 0 : clamp(fadeAge / TRAIL.fadeDuration, 0, 1);
        const boosted = clamp(
          1 + cell.velocity * TRAIL.velocityInfluence * 0.08,
          0,
          1,
        );
        const opacity =
          TRAIL.maxOpacity * boosted * attackProgress * (1 - fadeProgress);

        if (opacity <= 0) continue;

        ctx.globalAlpha = opacity;
        ctx.fillStyle = cell.color;
        // Rows are document-space, so subtract the scroll to place the cell.
        ctx.fillRect(
          cell.column * pitch,
          cell.row * pitch - window.scrollY,
          TRAIL.pixelSize,
          TRAIL.pixelSize,
        );
      }

      ctx.globalAlpha = 1;

      if (cells.size > 0) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        rafRef.current = 0;
      }
    };

    const scheduleDraw = () => {
      if (rafRef.current === 0) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    const paintAt = (clientX, clientY, velocity = 0) => {
      if (reducedMotionRef.current) return;
      const { width, height } = sizeRef.current;
      if (clientX < 0 || clientX > width || clientY < 0 || clientY > height) {
        return;
      }

      const color = inkAt(clientY, inkRef.current);
      if (!color) return;

      const column = Math.floor(clientX / pitch);
      // Document-space row: the cell belongs to the page, not the viewport, so
      // it stays under the same content while the page scrolls beneath it.
      const row = Math.floor((clientY + window.scrollY) / pitch);
      const key = `${column}:${row}`;
      activeCellsRef.current.set(key, {
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
      const previous = lastPointerRef.current;
      const velocity = previous
        ? clamp(
            Math.hypot(event.clientX - previous.x, event.clientY - previous.y) /
              (now - previous.time + 1),
            0,
            4,
          )
        : 0;

      if (!previous) {
        paintAt(event.clientX, event.clientY, velocity);
        lastPointerRef.current = {
          x: event.clientX,
          y: event.clientY,
          time: now,
        };
        return;
      }

      const distance = Math.hypot(
        event.clientX - previous.x,
        event.clientY - previous.y,
      );
      const spacing = Math.max(1, TRAIL.sampleSpacing * pitch);
      const steps = clamp(Math.ceil(distance / spacing), 1, 24);

      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        paintAt(
          previous.x + (event.clientX - previous.x) * t,
          previous.y + (event.clientY - previous.y) * t,
          velocity,
        );
      }

      lastPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: now,
      };
    };

    // Live cells have to be redrawn while scrolling now that their rows are
    // anchored to the document rather than the viewport.
    const onScroll = () => {
      if (activeCellsRef.current.size > 0) scheduleDraw();
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => {
      reducedMotionRef.current = motionQuery.matches;
      if (reducedMotionRef.current) {
        activeCellsRef.current.clear();
        clearCanvas();
      }
    };

    resize();
    syncMotion();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('pointerdown', handlePointer, { passive: true });
    motionQuery.addEventListener('change', syncMotion);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('pointerdown', handlePointer);
      motionQuery.removeEventListener('change', syncMotion);
      cancelAnimationFrame(rafRef.current);
      activeCellsRef.current.clear();
    };
  }, []);

  return (
    <div className='portfolio-pixel-trail'>
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
