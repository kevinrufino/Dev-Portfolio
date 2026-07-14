import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import Matter from 'matter-js';
import { clamp } from '../../utils/helpers.js';
import { LAB_PROJECTS, Thumb } from './labData.js';

const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Query, Sleeping } = Matter;

const POS_SNAP = 4; // px — bodies render on a 4px grid
const ANGLE_SNAP = Math.PI / 45; // 4° steps, so rotation reads as pixel-art
const GAP = 16;

const computeSlots = (cw, ch, w, h, n) => {
  const cols = Math.max(2, Math.min(n, Math.floor((cw - GAP) / (w + GAP))));
  const rows = Math.ceil(n / cols);
  const totalW = cols * w + (cols - 1) * GAP;
  const totalH = rows * h + (rows - 1) * GAP;
  const ox = (cw - totalW) / 2 + w / 2;
  const oy = Math.max(ch - totalH - 20 + h / 2, h / 2 + 12);
  return Array.from({ length: n }, (_, i) => ({
    x: ox + (i % cols) * (w + GAP),
    y: oy + Math.floor(i / cols) * (h + GAP),
  }));
};

/**
 * Rendition 03 — THE PIT.
 *
 * The projects section as a storage crate of physical cartridges. They rain
 * in when the crate scrolls into view (the same physics language as the
 * landing loader), then you can grab and throw them — a quick tap opens the
 * project. Physics runs continuous under the hood but renders snapped to a
 * 4px grid and 4° angle steps, so even the tumbling looks quantized.
 *
 * Per-frame work writes straight to element transforms; React never
 * re-renders during simulation.
 */
const CartridgePit = () => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [cardSize, setCardSize] = useState({ w: 150, h: 177 });
  const [mode, setMode] = useState('waiting'); // waiting | physics | tidy

  const containerRef = useRef(null);
  const cardRefs = useRef([]);
  const videoRefs = useRef([]);
  const engineRef = useRef(null);
  const bodiesRef = useRef([]);
  const rafRef = useRef(0);
  const modeRef = useRef('waiting');
  const pointerDownRef = useRef(null);
  const cardSizeRef = useRef(cardSize);

  const setModeBoth = useCallback(m => {
    modeRef.current = m;
    setMode(m);
  }, []);

  const syncBodies = useCallback(() => {
    const { w, h } = cardSizeRef.current;
    bodiesRef.current.forEach((b, i) => {
      const el = cardRefs.current[i];
      if (!el) return;
      const x = Math.round((b.position.x - w / 2) / POS_SNAP) * POS_SNAP;
      const y = Math.round((b.position.y - h / 2) / POS_SNAP) * POS_SNAP;
      const a = Math.round(b.angle / ANGLE_SNAP) * ANGLE_SNAP;
      el.style.transform = `translate(${x}px, ${y}px) rotate(${a}rad)`;
      el.style.opacity = '1';
    });
  }, []);

  // Park every body static on the grid, then let CSS (steps easing) tween
  // the cards over. Transform writes are deferred a frame so the transition
  // class is painted first.
  const tidy = useCallback(() => {
    const container = containerRef.current;
    const engine = engineRef.current;
    if (!container || !engine) return;
    const { w, h } = cardSizeRef.current;
    const slots = computeSlots(container.clientWidth, container.clientHeight, w, h, bodiesRef.current.length);
    bodiesRef.current.forEach((b, i) => {
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
      Body.setPosition(b, slots[i]);
      Body.setAngle(b, 0);
      Body.setStatic(b, true);
    });
    setModeBoth('tidy');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        bodiesRef.current.forEach((b, i) => {
          const el = cardRefs.current[i];
          if (!el) return;
          el.style.transform = `translate(${slots[i].x - w / 2}px, ${slots[i].y - h / 2}px) rotate(0rad)`;
          el.style.opacity = '1';
        });
      }),
    );
  }, [setModeBoth]);

  const wakeAll = useCallback(() => {
    bodiesRef.current.forEach(b => {
      Body.setStatic(b, false);
      Sleeping.set(b, false);
    });
    setModeBoth('physics');
  }, [setModeBoth]);

  const shake = useCallback(() => {
    if (!engineRef.current) return;
    if (modeRef.current !== 'physics') wakeAll();
    bodiesRef.current.forEach(b => {
      Sleeping.set(b, false);
      Body.setVelocity(b, {
        x: (Math.random() - 0.5) * 24,
        y: -(10 + Math.random() * 16),
      });
      Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.3);
    });
  }, [wakeAll]);

  // Build the world once the crate is measurable.
  const startPhysics = useCallback(() => {
    const container = containerRef.current;
    if (!container || engineRef.current) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const w = Math.round(clamp(cw / 7, 116, 172));
    const h = Math.round(w * 1.18);
    cardSizeRef.current = { w, h };
    setCardSize({ w, h });

    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1.3;
    engineRef.current = engine;

    const bodies = LAB_PROJECTS.map((p, i) =>
      Bodies.rectangle(
        w / 2 + 20 + Math.random() * (cw - w - 40),
        -h - i * (h * 0.9),
        w,
        h,
        {
          restitution: 0.26,
          friction: 0.55,
          frictionAir: 0.012,
          angle: (Math.random() - 0.5) * 0.5,
        },
      ),
    );
    bodiesRef.current = bodies;

    const wallOpts = { isStatic: true };
    Composite.add(engine.world, [
      ...bodies,
      Bodies.rectangle(cw / 2, ch + 100, cw + 400, 200, wallOpts),
      Bodies.rectangle(-100, ch / 2 - 1500, 200, ch + 4000, wallOpts),
      Bodies.rectangle(cw + 100, ch / 2 - 1500, 200, ch + 4000, wallOpts),
      Bodies.rectangle(cw / 2, -2600, cw + 400, 200, wallOpts),
    ]);

    const mouse = Mouse.create(container);
    // Matter's wheel capture would eat page scroll over the crate.
    ['mousewheel', 'DOMMouseScroll', 'wheel'].forEach(evt => {
      mouse.element.removeEventListener(evt, mouse.mousewheel);
    });
    const mc = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.14, damping: 0.1 },
    });
    Composite.add(engine.world, mc);

    Events.on(mc, 'startdrag', ({ body }) => {
      const i = bodies.indexOf(body);
      if (i === -1) return;
      cardRefs.current[i]?.classList.add('pit-grabbed');
      videoRefs.current[i]?.play?.().catch(() => {});
    });
    Events.on(mc, 'enddrag', ({ body }) => {
      const i = bodies.indexOf(body);
      if (i === -1) return;
      cardRefs.current[i]?.classList.remove('pit-grabbed');
    });

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (modeRef.current !== 'physics') return;
      Engine.update(engine, 1000 / 60);
      syncBodies();
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [syncBodies]);

  // Rain the cartridges in the first time the crate is actually on screen.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let dropped = false;
    const io = new IntersectionObserver(
      entries => {
        if (dropped || !entries.some(e => e.isIntersecting)) return;
        dropped = true;
        io.disconnect();
        startPhysics();
        if (prefersReducedMotion) {
          tidy();
        } else {
          setModeBoth('physics');
        }
      },
      { threshold: 0.3 },
    );
    io.observe(container);
    return () => io.disconnect();
  }, [startPhysics, tidy, setModeBoth, prefersReducedMotion]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      if (engineRef.current) {
        Engine.clear(engineRef.current);
        engineRef.current = null;
      }
    },
    [],
  );

  // Tap (no drag) opens the project; grabbing a tidy grid un-parks it.
  const onPointerDown = e => {
    const rect = containerRef.current.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pointerDownRef.current = { ...point, t: Date.now() };
    if (modeRef.current === 'tidy' && Query.point(bodiesRef.current, point).length) {
      wakeAll();
    }
  };

  const onPointerUp = e => {
    const d = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!d || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (Math.hypot(point.x - d.x, point.y - d.y) > 10 || Date.now() - d.t > 350) return;
    const hit = Query.point(bodiesRef.current, point)[0];
    if (!hit) return;
    const i = bodiesRef.current.indexOf(hit);
    if (i !== -1) navigate(`/projects/${LAB_PROJECTS[i].slug}`);
  };

  const controlButton =
    'font-offbit101Bold text-sm md:text-base border-2 border-ultra px-3 py-1.5 ' +
    'shadow-hard-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard ' +
    'active:translate-x-0 active:translate-y-0 active:shadow-hard-sm transition-all bg-acid';

  return (
    <section aria-label="Projects as physical cartridges">
      <div className="flex flex-wrap items-end justify-between gap-2 pb-2">
        <div>
          <h2 className="font-offbit101Bold uppercase text-2xl md:text-4xl leading-none">
            Exhibit Storage
          </h2>
          <p className="font-offbitDot text-[10px] md:text-xs tracking-[0.3em] uppercase opacity-80 pt-1">
            {String(LAB_PROJECTS.length).padStart(2, '0')} ITEMS — HANDLE WITHOUT CARE
          </p>
        </div>
        <div className="flex gap-2">
          <button className={controlButton} onClick={shake}>
            SHAKE ✦
          </button>
          <button className={controlButton} onClick={tidy}>
            TIDY □
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={clsx(
          'pit-stage relative h-[64svh] md:h-[72svh] border-4 border-ultra shadow-hard overflow-hidden',
          mode === 'tidy' && 'pit-tidy',
        )}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {/* crate backdrop */}
        <div className="pit-grid absolute inset-0 pointer-events-none" aria-hidden />
        <p
          className="absolute bottom-2 left-1/2 -translate-x-1/2 font-offbitDot text-[10px] md:text-xs tracking-[0.4em] uppercase opacity-40 pointer-events-none"
          aria-hidden
        >
          THROW THEM ✦ TAP ONE TO OPEN ITS FILE
        </p>

        {LAB_PROJECTS.map((p, i) => (
          <div
            key={p.slug}
            ref={el => {
              cardRefs.current[i] = el;
            }}
            className="pit-card absolute left-0 top-0 opacity-0 select-none pointer-events-none"
            style={{ width: cardSize.w, height: cardSize.h }}
            aria-hidden
          >
            <div className="pit-card-inner h-full flex flex-col border-[3px] border-ultra bg-acid overflow-hidden">
              <div className="relative flex-1 border-b-[3px] border-ultra overflow-hidden bg-ultra">
                <Thumb
                  project={p}
                  autoPlay={!p.isVideo}
                  videoRef={el => {
                    videoRefs.current[i] = el;
                  }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="px-1.5 py-1 bg-acid">
                <p className="font-offbit101Bold text-[12px] md:text-[13px] leading-tight uppercase truncate">
                  {p.display}
                </p>
                <p className="font-offbitDot text-[8px] tracking-[0.2em] opacity-80">
                  FILE {p.no} · {p.year}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* the physics cards are pointer-toys; this is the real, focusable index */}
      <nav className="sr-only" aria-label="Project files">
        <ul>
          {LAB_PROJECTS.map(p => (
            <li key={p.slug}>
              <Link to={`/projects/${p.slug}`}>
                {p.no} — {p.title} ({p.year})
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
};

export default CartridgePit;
