import { useEffect, useRef } from 'react';
import { pullOffset } from '../utils/cursorFx.js';

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
 * event, so moving the mouse never costs a React render. A frame loop runs
 * alongside it only while a gravity field is pulling: `cursorFx` publishes an
 * offset when the pointer nears something that wants to be hovered, and this
 * is where that offset becomes visible. Only the drawing moves — the real
 * pointer, and everything hit-tested against it, stays where the hand put it.
 *
 * Bails out entirely for coarse pointers (there is no cursor to replace on
 * touch) and for reduced motion, both of which leave the native cursor in
 * place — `cursor: none` is only applied under the same `(pointer: fine)`
 * query in index.css.
 */
const Cursor = () => {
  const elRef = useRef(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;

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

    // The arrow's tip is its top-left, so the -4px offset seats the drawn tip
    // on the actual pointer position rather than a few pixels down-right.
    const write = () => {
      const pull = pullOffset();
      el.style.transform =
        `translate3d(${x - 4 + pull.x}px, ${y - 4 + pull.y}px, 0)` +
        (down ? ' rotate(-12deg) scale(.96)' : '');
    };

    // The pull eases in and out on its own clock, so the arrow has to be
    // redrawn even while the mouse is perfectly still.
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (shown) write();
    };
    raf = requestAnimationFrame(tick);

    const onMove = event => {
      x = event.clientX;
      y = event.clientY;
      if (!shown) {
        shown = true;
        el.style.opacity = '1';
      }
      write();
    };
    const onDown = () => {
      down = true;
      write();
    };
    const onUp = () => {
      down = false;
      write();
    };
    // Hide when the pointer leaves the document, so the arrow isn't stranded
    // at the last edge position while the user is in another window.
    const onLeave = () => {
      shown = false;
      el.style.opacity = '0';
    };

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
        width='34'
        height='34'
        viewBox='0 0 24 24'
        fill='none'
        stroke='#ffffff'
        strokeWidth='2.35'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <path d='M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z' />
      </svg>
    </div>
  );
};

export default Cursor;
