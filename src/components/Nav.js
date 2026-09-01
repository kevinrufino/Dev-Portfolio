import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * home / work / connect — three states per item (plain text, hovered
 * squircle, selected squircle) plus a liquid-UI micro interaction: an
 * invisible spring-follower blob and the measured item pills all live in one
 * SVG goo-filtered layer, so the follower bulges/bridges into a pill as the
 * pointer approaches instead of just fading in.
 *
 * The whole nav sits in mix-blend-mode: difference — white pills/follower
 * and black knockout text keep every state legible over both the acid
 * background and the ultra name pile, no per-section palette needed.
 */

const NAV_LINKS = [
  { label: 'home', href: '/#home', sectionId: 'home' },
  { label: 'work', href: '/#projects', sectionId: 'projects' },
  { label: 'connect', href: '/#contact', sectionId: 'contact' },
];

const GOO_PAD = 90;
const GOO_SIGMA = 7;
const FOLLOWER_SIZE = 24;
const FOLLOWER_RANGE = 300;
const FOLLOWER_TINT = '#ffd9f2';
const HOVER_PILL_TINT = '#d9e6ff';
const ACTIVE_PILL_FILL = '#ffffff';
const ACTIVE_TEXT = '#000000';
const HOVER_TEXT = '#1e1e1e';

const GooeyNavFilter = ({ id }) => (
  <svg
    aria-hidden='true'
    width='0'
    height='0'
    style={{ position: 'absolute' }}
  >
    <defs>
      <filter
        id={id}
        x='-25%'
        y='-25%'
        width='150%'
        height='150%'
        colorInterpolationFilters='sRGB'
      >
        <feGaussianBlur in='SourceGraphic' stdDeviation={GOO_SIGMA} result='nb' />
        <feColorMatrix
          in='nb'
          type='matrix'
          values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -7'
        />
      </filter>
    </defs>
  </svg>
);

GooeyNavFilter.propTypes = {
  id: PropTypes.string.isRequired,
};

export const NavBar = ({ setCursor }) => {
  const navRef = useRef(null);
  const followerRef = useRef(null);
  const linkRefs = useRef([]);
  const rafRef = useRef(0);
  const slideTimerRef = useRef(null);
  const pointerRef = useRef({
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
    vx: 0,
    vy: 0,
    near: 0,
    targetNear: 0,
    primed: false,
  });

  const [rects, setRects] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hotIndex, setHotIndex] = useState(-1);
  const [sliding, setSliding] = useState(false);
  const [shown, setShown] = useState(false);

  const filterId = useMemo(
    () => `nav-goo-${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    const measure = () => {
      const nav = navRef.current;
      if (!nav) return;
      const navBox = nav.getBoundingClientRect();
      setRects(
        linkRefs.current.map(el => {
          if (!el) return { x: 0, y: 0, w: 0, h: 0 };
          const r = el.getBoundingClientRect();
          return {
            x: r.left - navBox.left,
            y: r.top - navBox.top,
            w: r.width,
            h: r.height,
          };
        }),
      );
    };
    requestAnimationFrame(measure);
    document.fonts?.ready.then(() => requestAnimationFrame(measure));
    window.addEventListener('resize', measure);

    // Active item follows scroll position; shown once the hero has scrolled
    // into the intro (~55% of the fold), hidden (and unclickable) on the hero.
    const onScroll = () => {
      const line = window.innerHeight * 0.38;
      let idx = 0;
      NAV_LINKS.forEach((link, i) => {
        const el = document.getElementById(link.sectionId);
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      });
      setActiveIndex(prev => {
        if (idx === prev) return prev;
        setSliding(true);
        clearTimeout(slideTimerRef.current);
        slideTimerRef.current = setTimeout(() => setSliding(false), 520);
        return idx;
      });
      setShown(window.scrollY >= window.innerHeight * 0.55);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Spring-follower blob: eases toward the pointer, ramps up size/opacity
    // as it nears the nav so it appears (and starts merging into pills via
    // the goo filter) well before the cursor actually arrives.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const p = pointerRef.current;
    const onMove = e => {
      const nav = navRef.current;
      if (!nav) return;
      const navBox = nav.getBoundingClientRect();
      p.tx = e.clientX - navBox.left;
      p.ty = e.clientY - navBox.top;
      const dx = Math.max(navBox.left - e.clientX, 0, e.clientX - navBox.right);
      const dy = Math.max(navBox.top - e.clientY, 0, e.clientY - navBox.bottom);
      const d = Math.hypot(dx, dy);
      p.targetNear = d >= FOLLOWER_RANGE ? 0 : 1 - d / FOLLOWER_RANGE;
      if (!p.primed) {
        p.primed = true;
        p.px = p.tx;
        p.py = p.ty;
      }
    };
    const loop = () => {
      p.vx = (p.vx + (p.tx - p.px) * 0.16) * 0.74;
      p.vy = (p.vy + (p.ty - p.py) * 0.16) * 0.74;
      p.px += p.vx;
      p.py += p.vy;
      p.near += (p.targetNear - p.near) * 0.13;
      const el = followerRef.current;
      if (el && p.primed) {
        el.style.transform = `translate3d(${p.px - FOLLOWER_SIZE / 2 + GOO_PAD}px, ${
          p.py - FOLLOWER_SIZE / 2 + GOO_PAD
        }px, 0) scale(${0.55 + 0.45 * p.near})`;
        el.style.opacity = String(Math.min(1, 0.25 + p.near * 1.35));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    if (!reduce) {
      window.addEventListener('pointermove', onMove, { passive: true });
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(slideTimerRef.current);
    };
  }, []);

  const activeRect = rects[activeIndex];
  const activePillStyle = {
    position: 'absolute',
    left: activeRect ? activeRect.x + GOO_PAD : GOO_PAD,
    top: activeRect ? activeRect.y + GOO_PAD : GOO_PAD,
    width: activeRect ? activeRect.w : 0,
    height: activeRect ? activeRect.h : 0,
    borderRadius: 9,
    background: ACTIVE_PILL_FILL,
    transformOrigin: '50% 50%',
    opacity: activeRect ? 1 : 0,
    transform: sliding ? 'scaleY(0.86)' : 'scaleY(1)',
    transition:
      'left 520ms cubic-bezier(.5,0,.18,1), width 520ms cubic-bezier(.5,0,.18,1), top 520ms cubic-bezier(.5,0,.18,1), height 300ms ease, transform 260ms ease, opacity 200ms ease',
  };

  const navColor = i =>
    i === activeIndex ? ACTIVE_TEXT : i === hotIndex ? HOVER_TEXT : '#ffffff';

  return (
    <nav
      ref={navRef}
      className='fixed top-4 left-4 z-20'
      style={{
        mixBlendMode: 'difference',
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(-14px)',
        pointerEvents: shown ? 'auto' : 'none',
        transition:
          'opacity 420ms cubic-bezier(.22,.8,.2,1), transform 520ms cubic-bezier(.22,.9,.24,1)',
      }}
      onMouseEnter={() => setCursor('')}
    >
      <GooeyNavFilter id={filterId} />

      <div
        aria-hidden='true'
        style={{
          position: 'absolute',
          inset: -GOO_PAD,
          pointerEvents: 'none',
          filter: `url(#${filterId})`,
        }}
      >
        <div style={activePillStyle} />
        {rects.map((r, i) => {
          const hover = i !== activeIndex && i === hotIndex;
          const inset = 5;
          return (
            <div
              key={NAV_LINKS[i].label}
              style={{
                position: 'absolute',
                left: r.x + GOO_PAD + inset,
                top: r.y + GOO_PAD + inset,
                width: r.w - inset * 2,
                height: r.h - inset * 2,
                borderRadius: 6,
                background: HOVER_PILL_TINT,
                transformOrigin: '50% 50%',
                opacity: hover ? 1 : 0,
                transform: hover ? 'scaleY(0.9)' : 'scale(0.66)',
                transition:
                  'opacity 200ms cubic-bezier(.22,.8,.2,1), transform 340ms cubic-bezier(.22,1.02,.28,1)',
              }}
            />
          );
        })}
        <div
          ref={followerRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: FOLLOWER_SIZE,
            height: FOLLOWER_SIZE,
            borderRadius: Math.round(FOLLOWER_SIZE * 0.28),
            background: FOLLOWER_TINT,
            transform: 'translate3d(-9999px, -9999px, 0)',
            opacity: 0,
            willChange: 'transform, opacity',
          }}
        />
      </div>

      <ul className='relative flex items-center gap-0.5 list-none m-0 p-0 font-offbit101Bold text-[22px] leading-none text-white'>
        {NAV_LINKS.map((link, i) => (
          <li key={link.label}>
            <a
              ref={el => {
                linkRefs.current[i] = el;
              }}
              href={link.href}
              className='block px-5 py-3 no-underline tracking-[0.02em] transition-colors duration-200'
              style={{ color: navColor(i) }}
              onMouseEnter={() => setHotIndex(i)}
              onMouseLeave={() => setHotIndex(-1)}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

NavBar.propTypes = {
  setCursor: PropTypes.func.isRequired,
};
