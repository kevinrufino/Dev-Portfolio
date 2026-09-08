import { useEffect, useState } from 'react';
import { debugFields } from '../utils/cursorFx.js';

/**
 * Draws every gravity field, so they can be argued with.
 *
 * A field is invisible by nature: the only signal that one is too small is
 * that nothing seems to happen, which is indistinguishable from it being
 * switched off. This puts the boundary on screen, names it, and prints its
 * reach — so "the CTA should start pulling from further out" becomes a number
 * rather than a feeling.
 *
 * Off by default. `?gravity` in the URL turns it on, and shift+G toggles it at
 * any time.
 *
 * The outer boundary's corners are quarter ellipses of the two sides that meet
 * there, which is not a stylistic choice: the gap to a box is a straight-line
 * distance normalised per side, so that shape IS the edge of the field. A
 * second dashed contour inside a target marks where its aim lets go, for the
 * ones that hold on past their own border.
 */
const HOTKEY = 'G';
const PARAM = 'gravity';

const CursorFxDebug = () => {
  const [on, setOn] = useState(false);
  const [fields, setFields] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(PARAM)) setOn(true);
    const onKey = event => {
      if (event.shiftKey && event.key.toUpperCase() === HOTKEY) {
        setOn(value => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!on) return undefined;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const w = window.innerWidth;
      const h = window.innerHeight;
      setSize({ w, h });
      // A field whose whole reach is off screen is noise; the elements behind
      // the sticky sections are still registered and would otherwise be drawn
      // on top of whatever the reader is actually looking at.
      setFields(
        debugFields().filter(({ geom, sides }) => {
          const l = (geom.r != null ? geom.x - geom.r : geom.left) - sides.left;
          const t = (geom.r != null ? geom.y - geom.r : geom.top) - sides.top;
          const r = (geom.r != null ? geom.x + geom.r : geom.right) + sides.right;
          const b =
            (geom.r != null ? geom.y + geom.r : geom.bottom) + sides.bottom;
          return r > 0 && l < w && b > 0 && t < h;
        }),
      );
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  if (!on) return null;

  return (
    <div
      aria-hidden='true'
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9996,
        pointerEvents: 'none',
      }}
    >
      <svg width={size.w} height={size.h} style={{ display: 'block' }}>
        {fields.map((field, i) => {
          const { geom, sides, name, strength, core } = field;
          const circle = geom.r != null;
          const x = circle ? geom.x - geom.r : geom.left;
          const y = circle ? geom.y - geom.r : geom.top;
          const w = circle ? geom.r * 2 : geom.right - geom.left;
          const h = circle ? geom.r * 2 : geom.bottom - geom.top;
          const { top, right, bottom, left } = sides;
          const even = top === right && right === bottom && bottom === left;
          // Each corner is a quarter ellipse of the two sides that meet there,
          // which is what an axis-normalised reach actually looks like.
          const reach = [
            `M ${x} ${y - top}`,
            `H ${x + w}`,
            `A ${right} ${top} 0 0 1 ${x + w + right} ${y}`,
            `V ${y + h}`,
            `A ${right} ${bottom} 0 0 1 ${x + w} ${y + h + bottom}`,
            `H ${x}`,
            `A ${left} ${bottom} 0 0 1 ${x - left} ${y + h}`,
            `V ${y}`,
            `A ${left} ${top} 0 0 1 ${x} ${y - top}`,
            'Z',
          ].join(' ');
          const label =
            `${name} · ` +
            (even
              ? `${Math.round(top)}px`
              : `t${Math.round(top)} r${Math.round(right)} b${Math.round(
                  bottom,
                )} l${Math.round(left)}`) +
            (strength === 1 ? '' : ` · ×${strength}`) +
            (core === 1 ? '' : ` · core ${core}`);
          return (
            <g key={`${name}-${i}`}>
              <path
                d={reach}
                fill='rgba(255,0,128,.07)'
                stroke='#ff0080'
                strokeWidth='1'
                strokeDasharray='5 4'
              />
              {/* the target itself */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={circle ? w / 2 : 0}
                ry={circle ? h / 2 : 0}
                fill='none'
                stroke='#ff0080'
                strokeWidth='1'
              />
              {/* where the aim finally lets go */}
              {core < 1 && (
                <rect
                  x={x + (w / 2) * core}
                  y={y + (h / 2) * core}
                  width={w * (1 - core)}
                  height={h * (1 - core)}
                  rx={circle ? (w * (1 - core)) / 2 : 0}
                  ry={circle ? (h * (1 - core)) / 2 : 0}
                  fill='none'
                  stroke='#ff0080'
                  strokeWidth='1'
                  strokeDasharray='2 3'
                />
              )}
              <rect
                x={x - left}
                y={y - top - 15}
                width={label.length * 6.2 + 10}
                height={15}
                fill='#ff0080'
              />
              <text
                x={x - left + 5}
                y={y - top - 4}
                fill='#fff'
                fontFamily='ui-monospace, SFMono-Regular, Menlo, monospace'
                fontSize='10'
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          position: 'fixed',
          left: 12,
          bottom: 12,
          background: '#ff0080',
          color: '#fff',
          font: '11px ui-monospace, SFMono-Regular, Menlo, monospace',
          padding: '5px 8px',
        }}
      >
        {fields.length} gravity field{fields.length === 1 ? '' : 's'} · shift+G
        to hide
      </div>
    </div>
  );
};

export default CursorFxDebug;
