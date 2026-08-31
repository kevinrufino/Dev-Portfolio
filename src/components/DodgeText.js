import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import {
  prepareWithSegments,
  layoutWithLines,
  clearCache,
} from '@chenglou/pretext';
import {
  registerDodgeTarget,
  resolveBox,
  isOutOfBand,
} from '../utils/dodgeField.js';

/**
 * Text that gets out of the way of the falling names.
 *
 * The names drain down the whole document once the hero floor opens, straight
 * through the copy below it. This component lets each individual line of that
 * copy step aside for the name crossing it and step straight back the moment
 * they part — no easing, no settle: the line is either clear or it is at rest.
 *
 * Why pretext: to move a line you first have to know where the line is, and
 * the browser will not tell you — a wrapped paragraph is one text node with no
 * addressable rows, and asking for client rects per range costs a layout on
 * every frame the names are falling. `@chenglou/pretext` breaks the string
 * into the exact lines the browser would have produced, in pure arithmetic
 * over cached glyph widths, so we can render each line as its own element and
 * then transform them independently at zero layout cost. Re-wrapping on resize
 * is likewise arithmetic, not reflow.
 *
 * Non-string children (a heading with a typewriter in it, say) can't be split
 * that way, so they dodge as a single block instead.
 */

// A line is only worth moving if the overlap is more than a rounding error.
const MIN_PUSH = 0.5;

/**
 * pretext caches the advance widths it measures per font. Anything measured
 * before the webfonts land is measured in the fallback face, so those cached
 * widths have to be thrown away once the real fonts are in — otherwise every
 * block stays wrapped to the wrong column width for the rest of the session.
 */
let fontsSettled = null;
const whenFontsSettled = () => {
  if (!fontsSettled) {
    fontsSettled = Promise.resolve(document.fonts?.ready).then(() => {
      clearCache();
    });
  }
  return fontsSettled;
};

const fontShorthand = style => {
  const size = style.fontSize || '16px';
  const family = style.fontFamily || 'sans-serif';
  const weight =
    style.fontWeight && style.fontWeight !== '400'
      ? `${style.fontWeight} `
      : '';
  const italic = style.fontStyle === 'italic' ? 'italic ' : '';
  return `${italic}${weight}${size} ${family}`;
};

const resolvedLineHeight = style => {
  const raw = parseFloat(style.lineHeight);
  if (Number.isFinite(raw)) return raw;
  // `normal` — the usual ~1.2em approximation is close enough here: it only
  // sets the height of the dodge box, not the text's own layout.
  return parseFloat(style.fontSize) * 1.2 || 16;
};

const DodgeText = ({ as: Tag = 'p', children, className, style, ...rest }) => {
  const hostRef = useRef(null);
  const lineElsRef = useRef([]);
  const boxesRef = useRef([]);
  const axesRef = useRef([]);
  const appliedRef = useRef([]);
  const boxPoolRef = useRef([]);
  const boundsRef = useRef(null); // resting vertical extent, for the band test
  // Lines are only ever produced in the browser; the first paint (and the test
  // renderer) shows the plain string, which is also the a11y/no-JS fallback.
  const [lines, setLines] = useState(null);

  const splittable = typeof children === 'string';

  // ── Measure: split the string into lines with pretext ─────────────────────
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !splittable) return undefined;

    let cancelled = false;

    const remeasure = () => {
      if (cancelled) return;
      const width = host.clientWidth;
      if (!width) return;
      const cs = window.getComputedStyle(host);
      const inner =
        width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (!(inner > 0)) return;
      // Two shapes of text can't be split faithfully, and don't need to be:
      // a nowrap run is a single line already, and a CSS-transformed run
      // ("uppercase") renders different glyphs than the string we'd measure.
      // Both fall through to dodging as one block.
      if (
        cs.whiteSpace === 'nowrap' ||
        cs.whiteSpace === 'pre' ||
        (cs.textTransform && cs.textTransform !== 'none')
      ) {
        setLines(null);
        return;
      }
      const tracking = parseFloat(cs.letterSpacing);
      try {
        const prepared = prepareWithSegments(children, fontShorthand(cs), {
          letterSpacing: Number.isFinite(tracking) ? tracking : 0,
          whiteSpace: cs.whiteSpace === 'pre-wrap' ? 'pre-wrap' : 'normal',
        });
        // A hair of slack absorbs the sub-pixel difference between the
        // browser's own line breaking and pretext's, so a line that exactly
        // fills the column doesn't wrap one word early.
        const laid = layoutWithLines(
          prepared,
          inner + 0.5,
          resolvedLineHeight(cs),
        );
        // The browser hangs a line's trailing space past the column edge;
        // an inline-block would instead count it as width, so drop it.
        setLines(laid.lines.map(line => line.text.replace(/\s+$/u, '')));
      } catch {
        setLines(null); // measurement unavailable — keep the plain string
      }
    };

    remeasure();
    // Webfonts change every advance width, so re-wrap once they land.
    whenFontsSettled().then(remeasure);
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(remeasure);
    ro?.observe(host);
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [children, splittable]);

  // Line refs are positional; drop any left over from a wider wrap.
  useLayoutEffect(() => {
    lineElsRef.current.length = lines ? lines.length : 0;
  }, [lines]);

  // ── Dodge: read line boxes, then push them clear ──────────────────────────
  // The field drives both halves once per frame: every registered block is
  // measured (reads), and only then is every block pushed (writes), so a page
  // full of dodging lines still costs one layout per frame, not one per line.
  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) {
      boxesRef.current.length = 0;
      boundsRef.current = null;
      return;
    }
    // Nothing is falling anywhere near this block: drop its boxes and skip the
    // rect reads entirely. apply() sees the empty list and puts anything still
    // displaced back at rest.
    if (isOutOfBand(boundsRef.current)) {
      boxesRef.current.length = 0;
      return;
    }

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const els = lines ? lineElsRef.current : [host];
    const boxes = boxesRef.current;
    const pool = boxPoolRef.current;
    boxes.length = 0;
    let top = Infinity;
    let bottom = -Infinity;

    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // Subtract the dodge already applied, so the resolve always runs against
      // the line's resting position and can never chase its own displacement.
      const displaced = appliedRef.current[i];
      const dx = displaced ? displaced.x : 0;
      const dy = displaced ? displaced.y : 0;

      let box = pool[boxes.length];
      if (!box) {
        box = { el: null, index: 0, left: 0, top: 0, right: 0, bottom: 0 };
        pool.push(box);
      }
      box.el = el;
      box.index = i;
      box.left = r.left + scrollX - dx;
      box.top = r.top + scrollY - dy;
      box.right = r.right + scrollX - dx;
      box.bottom = r.bottom + scrollY - dy;
      boxes.push(box);

      if (box.top < top) top = box.top;
      if (box.bottom > bottom) bottom = box.bottom;
    }

    // Resting extent of the whole block, for the next frame's band test.
    boundsRef.current = boxes.length > 0 ? { top, bottom } : null;
  }, [lines]);

  const apply = useCallback(
    active => {
      const boxes = boxesRef.current;
      const axes = axesRef.current;
      const applied = appliedRef.current;

      if (active) {
        for (let i = 0; i < boxes.length; i++) {
          const box = boxes[i];
          const push = resolveBox(box, axes[box.index]);
          axes[box.index] = push.axis;

          const x = Math.abs(push.x) > MIN_PUSH ? push.x : 0;
          const y = Math.abs(push.y) > MIN_PUSH ? push.y : 0;
          const prev = applied[box.index];
          if (prev && prev.x === x && prev.y === y) continue;
          applied[box.index] = { x, y };
          box.el.style.transform =
            x || y ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` : '';
        }
      }

      if (active && boxes.length > 0) return;

      // Unmount, simulation over, or the block was skipped as out of band —
      // nothing can be holding it aside, so put every line back where it was.
      const els = lineElsRef.current;
      for (let i = 0; i < applied.length; i++) {
        const displaced = applied[i];
        if (!displaced || (!displaced.x && !displaced.y)) continue;
        const el = lines ? els[i] : hostRef.current;
        if (el) el.style.transform = '';
      }
      applied.length = 0;
      axes.length = 0;
    },
    [lines],
  );

  // An inline box ignores transforms, so anything dodging as a whole block
  // (metadata runs, headings with markup in them) is nudged to inline-block.
  useEffect(() => {
    const host = hostRef.current;
    if (host && window.getComputedStyle(host).display === 'inline') {
      host.style.display = 'inline-block';
    }
  }, []);

  useEffect(() => {
    const target = { measure, apply };
    return registerDodgeTarget(target);
  }, [measure, apply]);

  return (
    <Tag ref={hostRef} className={className} style={style} {...rest}>
      {lines
        ? lines.map((text, i) => (
            // The outer span holds the line's place in the flow (and its
            // alignment); the inner one is exactly as wide as the glyphs, so
            // it is what gets measured and moved.
            <span key={i} className='dodge-line'>
              <span
                ref={el => {
                  lineElsRef.current[i] = el;
                }}
                className='dodge-line-text'
              >
                {text}
              </span>
            </span>
          ))
        : children}
    </Tag>
  );
};

DodgeText.propTypes = {
  as: PropTypes.elementType,
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default DodgeText;
