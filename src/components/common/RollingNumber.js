import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import useCountUp from '../../hooks/useCountUp.js';

/**
 * A number that rolls.
 *
 * Every digit is a column of 0–9 clipped to one line tall. Changing the value
 * slides the column up, so the old digit leaves through the top and the new one
 * arrives from below — an odometer, not a text node being rewritten.
 *
 * The roll is driven by the VALUE rather than by a transition, which is what
 * keeps it honest at both speeds it has to work at. The loader climbs 0→100
 * over a couple of seconds at 60fps; a CSS transition restarted on every one of
 * those frames would smear. Instead each column's position is a continuous
 * function of the number, so the units digit turns steadily, and a column
 * higher up only moves during the carry — the tens digit starts turning as the
 * units digit passes nine, exactly as a mechanical counter does.
 *
 * The strip carries a second zero after the nine so the wrap is a continuation
 * rather than a jump: the column rolls 9 → 10, which is the duplicate zero, and
 * the next frame is at 0, which is the first one. Same glyph, no snap back.
 *
 * ── how it is driven ────────────────────────────────────────────────────────
 *
 * Two callers, two drivers, one renderer:
 *
 * - The loader passes a live `value` and re-renders as it changes. The column
 *   positions are computed during render, so React writes them and there is no
 *   imperative code at all.
 * - A case study's impact figure passes `countOnView`. The markup then carries
 *   the FINAL figure — which is what shows with JS disabled, under reduced
 *   motion, or before the observer fires — and the count-up writes transforms
 *   straight to the DOM for its ~900ms, ending exactly where the markup already
 *   said it was.
 *
 * Either way the accessible text is the real number, once, beside a set of
 * columns marked `aria-hidden`: a screen reader should be told the figure, not
 * read eleven digits per place.
 */

// 0–9, then 0 again — see the note above about the wrap.
const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

// How late in a place's turn the place ABOVE it starts moving. 0.9 means the
// tens digit does its whole rotation while the units digit travels from nine to
// zero, which is the carry a mechanical counter performs.
const CARRY = 0.9;

/**
 * The places to draw, most significant first.
 *
 * Sized to the value the component was RENDERED with, which for a figure
 * counting on view is the final one. That is what makes the field wide enough
 * for the number it is counting to before it gets there, so a tile in a grid
 * does not reflow while its figure climbs from one digit to two. The places it
 * is not using yet are drawn and hidden rather than dropped — see `opacityFor`
 * — which is what reserves the width without printing a leading zero.
 */
const placesFor = (magnitude, decimals) => {
  const whole = Math.max(1, Math.floor(Math.abs(magnitude)));
  const top = Math.floor(Math.log10(whole));
  const places = [];
  for (let e = top; e >= -decimals; e--) places.push(e);
  return places;
};

/** Where the column for place `e` sits, in digit-heights, for this value. */
const positionAt = (value, e, least, snap) => {
  const scaled = Math.abs(value) / 10 ** e;
  const whole = Math.floor(scaled);
  const frac = scaled - whole;
  // The least significant place has nothing below it to wait for, so it turns
  // continuously; every other place waits for its carry.
  const carry = e === least ? 0 : CARRY;
  const roll = frac > carry ? (frac - carry) / (1 - carry) : 0;
  const digit = ((whole % 10) + 10) % 10;
  return snap ? Math.round(digit + roll) : digit + roll;
};

const transformFor = position =>
  `translate3d(0, calc(var(--roll-line) * ${-position}), 0)`;

/** A leading zero is drawn but not shown, so the field keeps its width. */
const opacityFor = (value, e) => (e > 0 && Math.abs(value) < 10 ** e ? 0 : 1);

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() =>
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq?.addEventListener) return undefined;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

const RollingNumber = ({
  value,
  decimals = 0,
  suffix = '',
  countOnView = false,
  className = '',
  ...rest
}) => {
  const reduced = usePrefersReducedMotion();
  const places = placesFor(value, decimals);
  const least = -decimals;
  const strips = useRef([]);
  const columns = useRef([]);

  const text = `${value.toFixed(decimals)}${suffix}`;

  // Only used while counting on view. Writes transforms directly: the value
  // changes every frame and none of that belongs in a React render.
  const paint = useCallback(
    at => {
      places.forEach((e, i) => {
        const strip = strips.current[i];
        const column = columns.current[i];
        if (strip)
          strip.style.transform = transformFor(
            positionAt(at, e, least, reduced),
          );
        if (column) column.style.opacity = String(opacityFor(at, e));
      });
    },
    // `places` is rebuilt every render but is a function of exactly these, and
    // a count-up only ever runs toward one fixed final value.
    [value, decimals, least, reduced],
  );

  // Only the count-up needs a ref on the root; the live driver is the render
  // itself. When `value` changes React rewrites the same inline styles the
  // count-up was writing by hand, so the two can never end up disagreeing.
  const ref = useCountUp(value, paint, countOnView);

  return (
    <span ref={ref} className={`roll ${className}`.trim()} {...rest}>
      {/* The real figure, for anything that reads rather than looks. The
          columns beside it are aria-hidden: a screen reader should be told the
          number, not read eleven digits for every place in it. */}
      <span className='sr-only'>{text}</span>
      <span aria-hidden='true' className='roll__field'>
        {places.map((e, i) => (
          <span className='roll__place' key={e}>
            {e === -1 && <span className='roll__sep'>.</span>}
            <span
              className='roll__col'
              ref={el => {
                columns.current[i] = el;
              }}
              style={{ opacity: opacityFor(value, e) }}
            >
              {/* In flow, invisible, and the only reason the column has a
                  baseline at all: an inline-block that clips takes its
                  baseline from its bottom edge rather than from its type, so
                  a window on its own would sit a descender high against the
                  words beside it. This holds the line; the window is laid
                  over it. It sets the width too, which is why every digit is
                  drawn in tabular figures. */}
              <span className='roll__ghost'>0</span>
              <span className='roll__window'>
                <span
                  className='roll__strip'
                  ref={el => {
                    strips.current[i] = el;
                  }}
                  style={{
                    transform: transformFor(
                      positionAt(value, e, least, reduced),
                    ),
                  }}
                >
                  {STRIP.map((d, at) => (
                    <span className='roll__d' key={`${d}-${at}`}>
                      {d}
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </span>
        ))}
        {suffix && <span className='roll__sep'>{suffix}</span>}
      </span>
    </span>
  );
};

RollingNumber.propTypes = {
  value: PropTypes.number.isRequired,
  /** Fixed decimal places. */
  decimals: PropTypes.number,
  /** Appended verbatim (%, ×, fps…). */
  suffix: PropTypes.string,
  /** Count 0 → value once, when it first scrolls into view. */
  countOnView: PropTypes.bool,
  className: PropTypes.string,
};

export default RollingNumber;
