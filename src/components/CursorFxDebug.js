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
 * The outer boundary is drawn as a rounded rectangle with the field's reach as
 * its corner radius, which is not a stylistic choice: the gap to a box is
 * measured as a straight-line distance, so the true edge of the field IS that
 * shape.
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
        debugFields().filter(({ geom, distance }) => {
          const left = (geom.r != null ? geom.x - geom.r : geom.left) - distance;
          const top = (geom.r != null ? geom.y - geom.r : geom.top) - distance;
          const right = (geom.r != null ? geom.x + geom.r : geom.right) + distance;
          const bottom = (geom.r != null ? geom.y + geom.r : geom.bottom) + distance;
          return right > 0 && left < w && bottom > 0 && top < h;
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
          const { geom, distance, name, strength } = field;
          const circle = geom.r != null;
          const x = circle ? geom.x - geom.r : geom.left;
          const y = circle ? geom.y - geom.r : geom.top;
          const w = circle ? geom.r * 2 : geom.right - geom.left;
          const h = circle ? geom.r * 2 : geom.bottom - geom.top;
          const label = `${name} · ${Math.round(distance)}px${
            strength === 1 ? '' : ` · ×${strength}`
          }`;
          return (
            <g key={`${name}-${i}`}>
              {/* the reach */}
              <rect
                x={x - distance}
                y={y - distance}
                width={w + distance * 2}
                height={h + distance * 2}
                rx={circle ? (w + distance * 2) / 2 : distance}
                ry={circle ? (h + distance * 2) / 2 : distance}
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
              <rect
                x={x - distance}
                y={y - distance - 15}
                width={label.length * 6.2 + 10}
                height={15}
                fill='#ff0080'
              />
              <text
                x={x - distance + 5}
                y={y - distance - 4}
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
