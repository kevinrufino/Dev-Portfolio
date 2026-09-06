import { useEffect, useRef, useState } from 'react';
import { setChip, subscribe } from '../utils/cursorFx.js';

/**
 * The chip that rides with the cursor and names what is under it.
 *
 * One instance for the whole page. Anything that wants to be annotated
 * registers itself with `useCursorFx`; this only draws whatever won.
 *
 * Position is written straight to the element by the registry, which steps it
 * along the 6px lattice rather than easing it, so it moves the way the rest of
 * the page is drawn. The transitions here are the other half of that: the chip
 * arrives and leaves smoothly, and a change of subject re-plays the arrival,
 * so the stepping never reads as something being dropped.
 */
const CursorAnnotation = () => {
  const elRef = useRef(null);
  const [state, setState] = useState({ label: '', tone: null, seq: 0 });

  useEffect(() => {
    const fine = window.matchMedia?.('(pointer: fine)');
    if (fine && !fine.matches) return undefined;
    setChip(elRef.current);
    const off = subscribe(next =>
      setState(prev => ({ ...next, seq: prev.seq + 1 })),
    );
    return () => {
      off();
      setChip(null);
    };
  }, []);

  const on = Boolean(state.label);
  const bg = state.tone?.bg || 'var(--ultra)';
  const ink = state.tone?.ink || 'var(--acid)';

  return (
    <div
      ref={elRef}
      aria-hidden='true'
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        // Under the cursor arrow, over everything else.
        zIndex: 9998,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
    >
      <span
        key={state.seq}
        className='font-offbit101Bold'
        style={{
          display: 'inline-block',
          padding: '5px 10px 4px',
          background: bg,
          color: ink,
          fontSize: 15,
          lineHeight: 1,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          // Hard offset shadow rather than a blur: the page has no soft edges
          // anywhere else, and a drop shadow here would be the only one.
          boxShadow: on ? '3px 3px 0 0 rgba(0,0,0,.28)' : 'none',
          opacity: on ? 1 : 0,
          transform: on ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(.88)',
          transformOrigin: '0 0',
          transition:
            'opacity 150ms cubic-bezier(.22,.8,.2,1), transform 190ms cubic-bezier(.22,1.1,.28,1)',
        }}
      >
        {state.label || ' '}
      </span>
    </div>
  );
};

export default CursorAnnotation;
