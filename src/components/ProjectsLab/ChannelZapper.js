import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { LAB_PROJECTS, Thumb } from './labData.js';

const N = LAB_PROJECTS.length;
const STATIC_CELL = 5; // css px per noise cell
const STATIC_MS = 240;
const ZAP_LOCK_MS = 420; // wheel repeat guard

/**
 * Rendition 01 — SIGNAL.
 *
 * The projects section as a broadcast television: one project on air at a
 * time, every navigation is a channel zap with a duotone static burst.
 * Wheel / arrow keys / digits 1–9 / the dial column all flip channels;
 * clicking (or tapping) the screen opens the project file. Swiping
 * vertically on touch zaps instead of opening.
 */
const ChannelZapper = () => {
  const [ch, setCh] = useState(0);
  const [power, setPower] = useState(true);
  const [signal, setSignal] = useState(4);
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();

  const screenRef = useRef(null);
  const staticRef = useRef(null);
  const counterRef = useRef(null);
  const burstToken = useRef(0);
  const wheelLock = useRef(0);
  const pointerDown = useRef(null);
  const powerRef = useRef(true);
  powerRef.current = power;

  const project = LAB_PROJECTS[ch];

  // Duotone static burst: a low-res canvas of pure acid/ultra noise,
  // upscaled with image-rendering: pixelated so every cell stays square.
  const playStatic = useCallback(() => {
    const canvas = staticRef.current;
    if (!canvas || prefersReducedMotion) return;
    const cols = Math.max(1, Math.ceil(canvas.clientWidth / STATIC_CELL));
    const rows = Math.max(1, Math.ceil(canvas.clientHeight / STATIC_CELL));
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    const token = ++burstToken.current;
    const start = performance.now();
    canvas.style.opacity = '1';
    const frame = () => {
      if (token !== burstToken.current) return;
      if (performance.now() - start > STATIC_MS) {
        canvas.style.opacity = '0';
        return;
      }
      const img = ctx.createImageData(cols, rows);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const acid = Math.random() < 0.55;
        d[i] = acid ? 241 : 62;
        d[i + 1] = acid ? 244 : 59;
        d[i + 2] = acid ? 59 : 244;
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [prefersReducedMotion]);

  const zapBy = useCallback(
    delta => {
      if (!powerRef.current) return;
      setCh(c => (c + delta + N) % N);
      setSignal(2 + Math.floor(Math.random() * 4));
      playStatic();
    },
    [playStatic],
  );

  const zapTo = useCallback(
    index => {
      if (!powerRef.current) return;
      setCh(index);
      setSignal(2 + Math.floor(Math.random() * 4));
      playStatic();
    },
    [playStatic],
  );

  // Wheel zaps channels. Attached manually because React registers wheel as
  // passive and the TV needs to eat the scroll while the pointer is on it.
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return undefined;
    const onWheel = e => {
      e.preventDefault();
      const now = performance.now();
      if (now - wheelLock.current < ZAP_LOCK_MS) return;
      if (Math.abs(e.deltaY) < 12) return;
      wheelLock.current = now;
      zapBy(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zapBy]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        zapBy(1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        zapBy(-1);
      } else if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === '0' ? 9 : Number(e.key) - 1;
        if (idx < N) zapTo(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zapBy, zapTo]);

  // Fake tape counter, written straight to the DOM so it never re-renders
  // the set.
  useEffect(() => {
    const mounted = Date.now();
    const id = setInterval(() => {
      if (!counterRef.current) return;
      const t = Math.floor((Date.now() - mounted) / 1000);
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(t % 60).padStart(2, '0');
      counterRef.current.textContent = `00:${mm}:${ss}`;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Tap = open file, vertical swipe = zap.
  const onPointerDown = e => {
    pointerDown.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onPointerUp = e => {
    const d = pointerDown.current;
    pointerDown.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      zapBy(dy < 0 ? 1 : -1);
      return;
    }
    if (Math.hypot(dx, dy) < 8 && Date.now() - d.t < 400 && power) {
      navigate(`/projects/${project.slug}`);
    }
  };

  const togglePower = () => {
    playStatic();
    setPower(p => !p);
  };

  const dialButton =
    'font-offbit101Bold border-2 border-ultra px-2 py-1 leading-none ' +
    'hover:bg-ultra hover:text-acid active:translate-x-0.5 ' +
    'active:translate-y-0.5 transition-none select-none';

  return (
    <section className="flex flex-col md:flex-row gap-3 md:gap-4" aria-label="Projects as TV channels">
      {/* ── The set ─────────────────────────────────────────────── */}
      <div
        ref={screenRef}
        className="relative flex-1 min-h-[58svh] md:min-h-[74svh] border-4 border-ultra bg-ultra shadow-hard overflow-hidden select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        role="button"
        tabIndex={0}
        aria-label={`Channel ${project.no}: ${project.title}. Press Enter to open.`}
        onKeyDown={e => {
          if (e.key === 'Enter' && power) navigate(`/projects/${project.slug}`);
        }}
      >
        {/* feed */}
        <div className={clsx('krtv-feed absolute inset-0', !power && 'krtv-feed-off')}>
          <Thumb
            key={project.slug}
            project={project}
            className="w-full h-full object-cover"
          />
        </div>

        {/* no signal */}
        {!power && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="blink font-offbitDot text-acid text-xl md:text-3xl tracking-[0.4em]">
              NO SIGNAL
            </p>
          </div>
        )}

        {/* scanlines + rolling broadcast band */}
        <div className="krtv-scanlines absolute inset-0 z-20 pointer-events-none" />
        {!prefersReducedMotion && power && (
          <div className="krtv-band absolute inset-x-0 z-20 pointer-events-none" />
        )}

        {/* static burst */}
        <canvas
          ref={staticRef}
          className="krtv-static absolute inset-0 z-30 w-full h-full pointer-events-none"
        />

        {/* OSD */}
        <div className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-between p-3 md:p-5">
          <div className="flex justify-between items-start">
            <span className="bg-ultra text-acid font-offbitDot text-sm md:text-xl tracking-[0.3em] px-2 py-1">
              CH {project.no}
            </span>
            <span className="bg-ultra text-acid font-offbitDot text-[10px] md:text-xs tracking-[0.25em] px-2 py-1 flex items-center gap-2">
              <span className="blink text-acid">●</span> REC{' '}
              <span ref={counterRef}>00:00:00</span>
            </span>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="max-w-[75%]">
              <p className="w-fit bg-ultra text-acid font-offbitDot text-[9px] md:text-xs tracking-[0.25em] uppercase px-2 py-1">
                {project.no} — {project.type} · {project.year}
              </p>
              <h2 className="mt-1 w-fit bg-ultra text-acid font-offbit101Bold uppercase leading-[0.95] text-3xl md:text-6xl px-2 py-1">
                {project.display}
              </h2>
            </div>
            <Link
              to={`/projects/${project.slug}`}
              className="pointer-events-auto shrink-0 bg-acid text-ultra font-offbit101Bold text-sm md:text-lg border-2 border-ultra px-2 py-1 shadow-hard-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard transition-all"
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
            >
              OPEN FILE →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Control column ──────────────────────────────────────── */}
      <div className="flex md:flex-col items-stretch gap-2 md:w-28 shrink-0">
        <p className="hidden md:block font-offbitDot text-[10px] tracking-[0.3em] text-center border-b-2 border-ultra pb-2">
          KRTV ✦ {String(N).padStart(2, '0')}CH
        </p>

        <div className="flex md:flex-col gap-1 flex-1 md:flex-none">
          <button className={clsx(dialButton, 'text-xl md:text-2xl flex-1')} onClick={() => zapBy(1)} aria-label="Channel up">
            CH+
          </button>
          <button className={clsx(dialButton, 'text-xl md:text-2xl flex-1')} onClick={() => zapBy(-1)} aria-label="Channel down">
            CH−
          </button>
        </div>

        <div className="grid grid-cols-5 md:grid-cols-2 gap-1 flex-[2] md:flex-none">
          {LAB_PROJECTS.map((p, i) => (
            <button
              key={p.slug}
              className={clsx(
                'font-offbitDot text-[10px] md:text-xs tracking-widest border-2 border-ultra py-1 leading-none',
                i === ch ? 'bg-ultra text-acid' : 'hover:bg-ultra hover:text-acid',
              )}
              onClick={() => zapTo(i)}
              aria-label={`Channel ${p.no}: ${p.title}`}
              aria-current={i === ch}
            >
              {p.no}
            </button>
          ))}
        </div>

        {/* signal meter */}
        <div className="hidden md:flex flex-col-reverse gap-1 items-center py-2" aria-hidden>
          {[0, 1, 2, 3, 4].map(i => (
            <span
              key={i}
              className={clsx(
                'block h-2 border-2 border-ultra',
                i < signal ? 'bg-ultra' : 'bg-transparent',
              )}
              style={{ width: `${34 + i * 14}%` }}
            />
          ))}
          <span className="font-offbitDot text-[9px] tracking-[0.3em] pt-1">SGNL</span>
        </div>

        <button
          className={clsx(
            dialButton,
            'text-sm md:text-base py-2',
            !power && 'bg-ultra text-acid',
          )}
          onClick={togglePower}
          aria-pressed={!power}
        >
          PWR
        </button>

        <p className="hidden md:block font-offbitDot text-[9px] tracking-[0.25em] text-center opacity-70 pt-1">
          SCROLL / 0–9
          <br />
          TO ZAP
        </p>
      </div>
    </section>
  );
};

export default ChannelZapper;
