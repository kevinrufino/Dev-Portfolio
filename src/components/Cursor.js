import { useEffect, useRef } from 'react';
import { aimState } from '../utils/cursorFx.js';

/**
 * The page cursor.
 *
 * A DOM arrow under `mix-blend-mode: difference` rather than a CSS
 * `cursor: url()` bitmap. The page crosses four grounds — acid hero, paper
 * intro, the projects index, charcoal footer — and a fixed-colour bitmap
 * cursor has to pick one of them to be legible against. Difference blending
 * inverts against whatever is underneath, so one white arrow reads on all
 * four.
 *
 * Position is written straight to the element's transform from the pointer
 * event, so moving the mouse never costs a React render.
 *
 * The arrow also AIMS. When the pointer comes within range of something that
 * wants to be found, `cursorFx` publishes the direction of it and the arrow
 * turns to point that way, like a needle — from wherever the hand has left
 * it, and pivoting on its own tip so the tip never leaves the pointer. The
 * position is never touched: the only thing a gravity field changes is which
 * way the cursor is looking.
 *
 * Bails out entirely for coarse pointers (there is no cursor to replace on
 * touch) and for reduced motion, both of which leave the native cursor in
 * place — `cursor: none` is only applied under the same `(pointer: fine)`
 * query in index.css.
 */

// Which way the drawn arrow points when nothing is pulling on it: up and to
// the left, the direction its own tip faces.
const REST_ANGLE = (-135 * Math.PI) / 180;
// The tip, in the 34px box. The SVG's point sits at (4.04, 4.04) of a 24-unit
// viewBox, and rotation has to pivot there or the arrow swings off the
// pointer as it turns.
const TIP = (4.04 / 24) * 34;

const Cursor = () => {
  const elRef = useRef(null);
  const artRef = useRef(null);

  useEffect(() => {
    const el = elRef.current;
    const art = artRef.current;
    if (!el || !art) return undefined;

    const fine = window.matchMedia('(pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || still.matches) {
      el.style.display = 'none';
      return undefined;
    }

    let x = -100;
    let y = -100;
    let down = false;
    let shown = false;
    let drawn = -999;

    const place = () => {
      el.style.transform = `translate3d(${x - 4}px, ${y - 4}px, 0)`;
    };

    // The turn is the only part that needs a frame loop: the aim eases toward
    // its target on its own clock, so the arrow has to be redrawn even while
    // the mouse is perfectly still.
    const turn = () => {
      const { angle, weight } = aimState();
      // Shortest way round, or the arrow takes the long way about whenever a
      // target sits just across the -180/180 seam.
      let delta = (angle - REST_ANGLE) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      const deg = (delta * weight * 180) / Math.PI;
      if (Math.abs(deg - drawn) < 0.15) return;
      drawn = deg;
      art.style.transform =
        `rotate(${deg.toFixed(2)}deg)` + (down ? ' scale(.94)' : '');
    };

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (shown) turn();
    };
    raf = requestAnimationFrame(tick);

    const onMove = event => {
      x = event.clientX;
      y = event.clientY;
      if (!shown) {
        shown = true;
        el.style.opacity = '1';
      }
      place();
    };
    const press = value => {
      down = value;
      drawn = -999;
      turn();
    };
    // Hide when the pointer leaves the document, so the arrow isn't stranded
    // at the last edge position while the user is in another window.
    const onLeave = () => {
      shown = false;
      el.style.opacity = '0';
    };

    const onDown = () => press(true);
    const onUp = () => press(false);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={elRef}
      aria-hidden='true'
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        width: 34,
        height: 34,
        pointerEvents: 'none',
        mixBlendMode: 'difference',
        opacity: 0,
        willChange: 'transform',
      }}
    >
      <svg
        ref={artRef}
        width='34'
        height='34'
        viewBox='0 0 24 24'
        fill='none'
        stroke='#ffffff'
        strokeWidth='2.35'
        strokeLinecap='round'
        strokeLinejoin='round'
        style={{
          display: 'block',
          transformOrigin: `${TIP}px ${TIP}px`,
          willChange: 'transform',
        }}
      >
        <path d='M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z' />
      </svg>
    </div>
  );
};

export default Cursor;
