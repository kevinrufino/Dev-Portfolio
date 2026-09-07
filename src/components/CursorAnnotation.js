import { useEffect, useRef, useState } from 'react';
import { setChip, subscribe } from '../utils/cursorFx.js';

/**
 * Chip icons.
 *
 * Drawn rather than typed: an emoji is a third party's artwork at a size and
 * colour nobody here chose, and next to 11px type it dwarfs the label it is
 * supposed to introduce. These are on the same lattice as everything else and
 * inherit the chip's ink.
 */
const EyeIcon = props => (
  <svg
    width='11'
    height='11'
    viewBox='0 0 11 11'
    fill='currentColor'
    shapeRendering='crispEdges'
    aria-hidden='true'
    {...props}
  >
    <path d='M3 2h5v1H3z M1 3h2v1H1z M8 3h2v1H8z M0 4h1v3H0z M10 4h1v3h-1z M1 7h2v1H1z M8 7h2v1H8z M3 8h5v1H3z M4 4h3v3H4z' />
  </svg>
);

const ICONS = { eye: EyeIcon };

/**
 * The chip that rides with the cursor and names what is under it.
 *
 * One instance for the whole page. Anything that wants to be annotated
 * registers itself with `useCursorFx`; this only draws whatever won.
 *
 * Position is written straight to the element by the registry, on the pointer
 * event itself. Nothing about the following is eased or stepped — the chip is
 * exactly where the cursor is, on the same frame. Only the states are
 * animated: it arrives and leaves smoothly, and a change of subject re-plays
 * the arrival.
 *
 * Set in the body face rather than the display one. OffBit is wide and loud
 * at any size, and a label that names what is under the pointer should be
 * read at a glance and then ignored.
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
  const Icon = ICONS[state.icon];

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
        className='type-body'
        style={{
          display: 'inline-block',
          padding: '4px 8px 3px',
          background: bg,
          color: ink,
          fontSize: 11,
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: '.02em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          // Hard offset shadow rather than a blur: the page has no soft edges
          // anywhere else, and a drop shadow here would be the only one.
          boxShadow: on ? '2px 2px 0 0 rgba(0,0,0,.26)' : 'none',
          opacity: on ? 1 : 0,
          transform: on ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(.88)',
          transformOrigin: '0 0',
          transition:
            'opacity 150ms cubic-bezier(.22,.8,.2,1), transform 190ms cubic-bezier(.22,1.1,.28,1)',
        }}
      >
        {Icon && (
          <Icon
            style={{
              display: 'inline-block',
              marginRight: 5,
              verticalAlign: '-1px',
            }}
          />
        )}
        {state.label || ' '}
      </span>
    </div>
  );
};

export default CursorAnnotation;
