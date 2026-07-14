import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { clamp } from '../../utils/helpers.js';
import Reveal from '../Reveal.js';
import { LAB_PROJECTS, Thumb } from './labData.js';

const SNAP = 28; // preview renders on a 28px pixel grid
const CHASE = 0.2; // per-frame lerp toward the pointer — flow under the snap
const FOCUS_LINE = 0.42; // scroll mode: viewport fraction where a row goes hot

const COUNT = String(LAB_PROJECTS.length).padStart(2, '0');

/**
 * Rendition 02 — THE LEDGER.
 *
 * The projects section as a typographic file index: giant outlined titles
 * stacked like a poster. The hot row dither-fills ultra, swaps its title
 * for a scrolling marquee, and shows a thumbnail preview.
 *
 * Two input modes, one visual state:
 *  - hover devices: rows go hot under the pointer; the preview chases it —
 *    lerped for flow, then snapped to a 28px grid so it still moves in
 *    pixel jumps.
 *  - touch / no-hover devices: the row crossing a fixed focus line goes hot
 *    as you scroll, and the preview lives in a dock pinned to the bottom
 *    corner. No touch-and-hold anywhere.
 *
 * All hot-state visuals key off an `is-hot` class set from React state, so
 * both modes share the exact same CSS.
 */
const LedgerIndex = () => {
  const [hot, setHot] = useState(-1);
  const [hoverable, setHoverable] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const previewRef = useRef(null);
  const rowRefs = useRef([]);
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef(null); // continuous chase position; null = teleport next write

  useEffect(() => {
    // `?touch=1` forces scroll mode for testing scroll activation on a
    // hover-capable machine.
    if (new URLSearchParams(window.location.search).has('touch')) {
      setHoverable(false);
      return undefined;
    }
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setHoverable(mq.matches);
    const onChange = e => setHoverable(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const snapPoint = useCallback(el => {
    const w = el.offsetWidth || 320;
    const h = el.offsetHeight || 240;
    let x = clamp(pos.current.x + 28, 12, window.innerWidth - w - 12);
    let y = clamp(pos.current.y - h - 24, 12, window.innerHeight - h - 12);
    x = Math.round(x / SNAP) * SNAP;
    y = Math.round(y / SNAP) * SNAP;
    return { x, y };
  }, []);

  // First placement runs synchronously post-commit so the preview never
  // paints at a stale corner before the chase loop's first frame.
  useLayoutEffect(() => {
    if (hot < 0 || !hoverable) return;
    const el = previewRef.current;
    if (!el || pos.current) return;
    pos.current = { ...target.current };
    const p = snapPoint(el);
    el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  }, [hot, hoverable, snapPoint]);

  // Chase loop: lerp a continuous position toward the pointer every frame,
  // then quantize. The motion flows; the rendering stays on the grid.
  // Writes go straight to the transform — no re-renders.
  useEffect(() => {
    if (hot < 0 || !hoverable) {
      pos.current = null;
      return undefined;
    }
    const el = previewRef.current;
    if (!el) return undefined;
    let raf = 0;
    let written = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!pos.current) pos.current = { ...target.current };
      pos.current.x += (target.current.x - pos.current.x) * CHASE;
      pos.current.y += (target.current.y - pos.current.y) * CHASE;
      const p = snapPoint(el);
      if (!written || written.x !== p.x || written.y !== p.y) {
        written = p;
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      }
    };
    const onMove = e => {
      target.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [hot, hoverable, snapPoint]);

  // Scroll mode: the row under the focus line is hot. Contiguous rows make
  // the containing test stable — no hysteresis needed.
  useEffect(() => {
    if (hoverable) return undefined;
    let raf = 0;
    const pick = () => {
      raf = 0;
      const line = window.innerHeight * FOCUS_LINE;
      let next = -1;
      rowRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) next = i;
      });
      setHot(h => (h === next ? h : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [hoverable]);

  const enterRow = (i, e) => {
    if (e && typeof e.clientX === 'number' && e.clientX > 0) {
      target.current = { x: e.clientX, y: e.clientY };
    }
    setHot(i);
  };

  const focusRow = (i, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    target.current = {
      x: window.innerWidth - 420,
      y: rect.top + rect.height / 2,
    };
    setHot(i);
  };

  const hotProject = hot >= 0 ? LAB_PROJECTS[hot] : null;

  return (
    <section aria-label="Projects as a file index">
      {/* index header */}
      <div className="flex items-baseline justify-between border-b-2 border-ultra px-3 md:px-6 pb-2">
        <p className="font-offbitDot text-[10px] md:text-xs tracking-[0.3em] uppercase">
          FILE INDEX — {COUNT} ENTRIES
        </p>
        <p className="font-offbitDot text-[10px] md:text-xs tracking-[0.3em] uppercase opacity-70">
          KR ARCHIVE ✦ 2019–2026
        </p>
      </div>

      {LAB_PROJECTS.map((p, i) => {
        const isHot = hot === i;
        const showMarquee = isHot && !prefersReducedMotion;
        const chunk = Array(8).fill(`${p.display} ✦ `).join('');
        return (
          <Reveal key={p.slug} delay={i * 0.04} y={18}>
            <Link
              to={`/projects/${p.slug}`}
              ref={el => {
                rowRefs.current[i] = el;
              }}
              className={clsx(
                'ledger-row relative block border-b-2 border-ultra focus:outline-none focus-visible:outline-none',
                isHot && 'is-hot',
              )}
              onPointerEnter={hoverable ? e => enterRow(i, e) : undefined}
              onPointerLeave={hoverable ? () => setHot(-1) : undefined}
              onFocus={e => focusRow(i, e)}
              onBlur={() => setHot(-1)}
            >
              {/* dither fill (CSS-driven off is-hot, see lab.css) */}
              <span className="ledger-fill absolute inset-0" aria-hidden />

              <div className="relative z-10 grid grid-cols-[2.5rem_1fr_auto] md:grid-cols-[4rem_1fr_auto] items-center gap-2 md:gap-6 px-3 md:px-6 py-3 md:py-4">
                <span className="ledger-meta font-offbitDot text-xs md:text-sm tracking-[0.25em]">
                  {p.no}
                </span>

                <h3
                  className={clsx(
                    'ledger-title font-offbit101Bold uppercase leading-[0.9] text-[10.5vw] md:text-[5vw]',
                    showMarquee && 'opacity-0',
                  )}
                >
                  {p.display}
                </h3>

                <span className="flex flex-col items-end gap-1">
                  <span className="ledger-meta font-offbitDot text-xs md:text-sm tracking-[0.25em]">
                    {p.year}
                  </span>
                  <span className="ledger-open hidden md:inline font-offbitDot text-[10px] tracking-[0.25em] text-acid">
                    OPEN →
                  </span>
                </span>
              </div>

              {/* marquee overlay while hot */}
              {showMarquee && (
                <div className="ledger-marquee pointer-events-none absolute inset-0 z-20 flex items-center overflow-hidden">
                  <div className="marquee-track whitespace-nowrap font-offbit101Bold uppercase text-acid leading-[0.9] text-[10.5vw] md:text-[5vw]">
                    <span>{chunk}</span>
                    <span>{chunk}</span>
                  </div>
                </div>
              )}
            </Link>
          </Reveal>
        );
      })}

      <div className="flex items-baseline justify-between px-3 md:px-6 pt-2">
        <p className="font-offbitDot text-[10px] md:text-xs tracking-[0.3em] uppercase opacity-70">
          END OF INDEX — {COUNT}/{COUNT} FILES ACCOUNTED FOR
        </p>
        <p className="font-offbitDot text-[10px] md:text-xs tracking-[0.3em]">:]</p>
      </div>

      {/* hover devices: floating preview chasing the pointer on the grid */}
      {hoverable && hotProject && (
        <div
          ref={previewRef}
          className="fixed left-0 top-0 z-[60] pointer-events-none will-change-transform"
        >
          <div
            key={hotProject.slug}
            className="ledger-preview border-[3px] border-ultra bg-acid shadow-hard p-1"
          >
            <Thumb
              project={hotProject}
              className="block w-[300px] h-[190px] object-cover border-2 border-ultra"
            />
            <div className="flex justify-between font-offbitDot text-[10px] tracking-[0.25em] px-1 pt-1.5 pb-0.5">
              <span>FILE {hotProject.no}</span>
              <span>{hotProject.year}</span>
            </div>
          </div>
        </div>
      )}

      {/* touch devices: docked preview pinned to the bottom corner */}
      {!hoverable && hotProject && (
        <div className="ledger-dock fixed z-[60] pointer-events-none">
          <div
            key={hotProject.slug}
            className="ledger-dock-card border-[3px] border-ultra bg-acid shadow-hard-sm p-1"
          >
            <Thumb
              project={hotProject}
              className="block w-full h-[30vw] max-h-[150px] object-cover border-2 border-ultra"
            />
            <div className="flex justify-between font-offbitDot text-[9px] tracking-[0.25em] px-0.5 pt-1">
              <span>FILE {hotProject.no}</span>
              <span>{hotProject.year}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LedgerIndex;
