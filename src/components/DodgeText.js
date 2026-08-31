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
  measureNaturalWidth,
  clearCache,
} from '@chenglou/pretext';
import {
  registerDodgeTarget,
  resolveBox,
  intersectsAny,
  isOutOfBand,
} from '../utils/dodgeField.js';

/**
 * Text whose individual characters get out of the way of the falling names.
 *
 * The names drain down the whole document once the hero floor opens, straight
 * through the copy below. Every character here is its own element, so a name
 * crossing a line shoves aside only the letters it actually covers and the
 * text parts around it; each letter jumps straight back the frame contact
 * ends. No easing, no settle: a character is either clear or at rest.
 *
 * Why pretext: characters can only move independently if they are laid out
 * independently, and the browser will not hand over that geometry -- a wrapped
 * paragraph is one text node, and a span per character in normal flow re-wraps
 * on its own terms and loses the original line breaks. pretext gives both
 * halves over cached glyph widths: `layoutWithLines` for exactly the lines the
 * browser would have produced, and `measureNaturalWidth` over each word's
 * prefixes for the pen position of every character inside them. So every glyph
 * is absolutely positioned at a known offset, the block occupies exactly the
 * space it did before -- measured against the plain text it matches to within
 * a hundredth of a pixel -- and re-wrapping on resize is arithmetic rather
 * than reflow.
 *
 * The rendered characters are `aria-hidden` and unselectable; a visually
 * hidden copy of the real string carries the text for assistive tech and for
 * copy/paste. Content that can't be split this way -- a heading with a
 * typewriter inside it, say -- dodges as a single block instead.
 */

// A character is only worth moving if the overlap is more than a rounding error.
const MIN_PUSH = 0.5;

// Measured widths keyed by font + string. pretext caches its own per-segment
// measurements; this saves re-preparing the same short prefixes over and over
// across a page of text ("the", "to", "and" recur constantly).
const widthCache = new Map();

/**
 * pretext caches the advance widths it measures per font. Anything measured
 * before the webfonts land is measured in the fallback face, so those cached
 * widths have to be thrown away once the real fonts are in -- otherwise every
 * block stays laid out to the wrong metrics for the rest of the session.
 */
let fontsSettled = null;
const whenFontsSettled = () => {
  if (!fontsSettled) {
    fontsSettled = Promise.resolve(document.fonts?.ready).then(() => {
      clearCache();
      widthCache.clear();
    });
  }
  return fontsSettled;
};

const naturalWidth = (text, font) => {
  const key = `${font}|${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  const width = measureNaturalWidth(prepareWithSegments(text, font));
  widthCache.set(key, width);
  return width;
};

// Any glyph will do to put whitespace in a context where it has width; see
// spaceAdvance below.
const SPACER = 'x';

/**
 * The advance of a whitespace run mid-line.
 *
 * Measured on its own it comes back as zero: a string of nothing but
 * whitespace is all *trailing* whitespace, which hangs past the column edge
 * rather than taking width. Putting it between two glyphs and subtracting them
 * back out gives the width it actually occupies inside a line.
 */
const spaceAdvance = (run, font) =>
  naturalWidth(SPACER + run + SPACER, font) - 2 * naturalWidth(SPACER, font);

const isBlank = grapheme => grapheme.trim() === '';

let segmenter = null;
const graphemesOf = text => {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return Array.from(text);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  }
  const out = [];
  for (const { segment } of segmenter.segment(text)) out.push(segment);
  return out;
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
  // `normal` -- the usual ~1.2em approximation is close enough here: it only
  // sets the height of the dodge box, not the text's own layout.
  return parseFloat(style.fontSize) * 1.2 || 16;
};

// CSS uppercases and lowercases the glyphs the reader sees, so those are the
// glyphs to measure and to render. The real string still reaches assistive
// tech through the visually hidden copy. `capitalize` is per-word rather than
// per-character, so blocks using it fall back to dodging as one piece.
const transformed = (text, textTransform) => {
  if (textTransform === 'uppercase') return text.toUpperCase();
  if (textTransform === 'lowercase') return text.toLowerCase();
  return text;
};

/**
 * Lay a string out into lines of positioned characters.
 * @param {string} text
 * @param {CSSStyleDeclaration} cs computed style of the host
 * @param {number} maxWidth content width to wrap into
 * @returns {{lineHeight:number, lines:Array<{width:number, chars:Array}>}}
 */
const layoutCharacters = (text, cs, maxWidth) => {
  const font = fontShorthand(cs);
  const lineHeight = resolvedLineHeight(cs);
  const tracking = parseFloat(cs.letterSpacing);
  const letterSpacing = Number.isFinite(tracking) ? tracking : 0;
  const nowrap = cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre';

  const prepared = prepareWithSegments(
    transformed(text, cs.textTransform),
    font,
    {
      letterSpacing,
      whiteSpace: cs.whiteSpace === 'pre-wrap' ? 'pre-wrap' : 'normal',
    },
  );
  // A hair of slack absorbs the sub-pixel difference between the browser's own
  // line breaking and pretext's, so a line that exactly fills the column
  // doesn't wrap one word early. A nowrap run is one line however long it is.
  const laid = layoutWithLines(
    prepared,
    nowrap ? Number.MAX_SAFE_INTEGER : maxWidth + 0.5,
    lineHeight,
  );

  const lines = laid.lines.map(line => {
    const chars = [];
    // The browser hangs a line's trailing space past the column edge, so it
    // costs no width here either.
    const graphemes = graphemesOf(line.text.replace(/\s+$/u, ''));
    let x = 0;
    let i = 0;

    while (i < graphemes.length) {
      if (isBlank(graphemes[i])) {
        // Whitespace has no glyph to move -- it only advances the pen.
        x += spaceAdvance(graphemes[i], font) + letterSpacing;
        i += 1;
        continue;
      }
      // A word is measured by its prefixes rather than character by character:
      // fonts kern, so a letter's advance depends on the one before it, and
      // summing letters measured alone drifts wider than the real text (~2%
      // over a line in this face, enough to push a line out of its column).
      // The difference between two prefixes is exactly the in-context advance.
      let prefix = '';
      let measured = 0;
      while (i < graphemes.length && !isBlank(graphemes[i])) {
        prefix += graphemes[i];
        const width = naturalWidth(prefix, font);
        const advance = Math.max(0, width - measured);
        chars.push({ ch: graphemes[i], x, w: advance });
        x += advance + letterSpacing;
        measured = width;
        i += 1;
      }
    }

    // `x` still carries the letter-spacing after the final character, which is
    // exactly what CSS does — the line box is that much wider than its glyphs.
    return { chars, width: x };
  });

  return { lineHeight, lines };
};

// Pooled boxes: the resolve runs over every character on the page on every
// frame of the drain, so none of this allocates in the steady state.
const boxAt = (pool, i, line, left, top, width, height) => {
  let box = pool[i];
  if (!box) {
    box = { index: 0, line: 0, left: 0, top: 0, right: 0, bottom: 0 };
    pool[i] = box;
  }
  box.index = i;
  box.line = line;
  box.left = left;
  box.top = top;
  box.right = left + width;
  box.bottom = top + height;
  return box;
};

const REST = { x: 0, y: 0, axis: null };

// `line` markers on a box: the host dodging as one piece belongs to no line,
// and a character whose line element hasn't mounted yet has nothing to test.
const WHOLE_BLOCK = -1;
const SKIP = -2;

const DodgeText = ({ as: Tag = 'p', children, className, style, ...rest }) => {
  const hostRef = useRef(null);
  const lineElsRef = useRef([]);
  const charElsRef = useRef([]);
  const charMetaRef = useRef([]); // { line, x, w } per rendered character
  const lineBoxesRef = useRef([]);
  const charBoxesRef = useRef([]);
  const axesRef = useRef([]);
  const appliedRef = useRef([]);
  const boundsRef = useRef(null); // resting vertical extent, for the band test
  // Characters are only ever laid out in the browser; the first paint (and the
  // test renderer) shows the plain string, which is also the no-JS fallback.
  const [layout, setLayout] = useState(null);

  const splittable = typeof children === 'string' && children.trim() !== '';

  // -- Lay out: split the string into positioned characters with pretext -----
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !splittable) return undefined;

    let cancelled = false;

    const relayout = () => {
      if (cancelled) return;
      const cs = window.getComputedStyle(host);
      if (cs.textTransform === 'capitalize') {
        setLayout(null); // per-word casing -- dodge the block as one piece
        return;
      }
      const inner =
        host.clientWidth -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      const nowrap = cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre';
      if (!nowrap && !(inner > 0)) return;
      try {
        setLayout(layoutCharacters(children, cs, inner));
      } catch {
        setLayout(null); // measurement unavailable -- keep the plain string
      }
    };

    relayout();
    // Webfonts change every advance, so lay out again once they land.
    whenFontsSettled().then(relayout);
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(relayout);
    ro?.observe(host);
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [children, splittable]);

  // Element refs are positional; drop any left over from a previous layout.
  useLayoutEffect(() => {
    const metas = charMetaRef.current;
    metas.length = 0;
    if (layout) {
      layout.lines.forEach((line, index) => {
        for (const char of line.chars) {
          metas.push({ line: index, x: char.x, w: char.w });
        }
      });
    }
    lineElsRef.current.length = layout ? layout.lines.length : 0;
    charElsRef.current.length = metas.length;
    appliedRef.current.length = 0;
    axesRef.current.length = 0;
  }, [layout]);

  // -- Dodge: read one rect per line, then push the characters clear ---------
  // The field drives both halves once per frame: every registered block is
  // measured (reads), and only then is every block pushed (writes), so the
  // whole page costs one layout per frame. Characters never need a rect of
  // their own -- their boxes fall out of the line's origin and pretext's
  // advances, which is the whole point of laying them out this way.
  const measure = useCallback(() => {
    const host = hostRef.current;
    const lineBoxes = lineBoxesRef.current;
    const charBoxes = charBoxesRef.current;

    if (!host) {
      lineBoxes.length = 0;
      charBoxes.length = 0;
      boundsRef.current = null;
      return;
    }
    // Nothing is falling anywhere near this block: drop its boxes and skip the
    // rect reads entirely. apply() sees the empty list and puts anything still
    // displaced back at rest.
    if (isOutOfBand(boundsRef.current)) {
      lineBoxes.length = 0;
      charBoxes.length = 0;
      return;
    }

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    lineBoxes.length = 0;
    charBoxes.length = 0;

    if (!layout) {
      // Whole-block dodge: the host itself is the only box. Its own transform
      // has to come back off, since here the measured element is the moved one.
      const r = host.getBoundingClientRect();
      const displaced = appliedRef.current[0];
      const box = boxAt(
        charBoxes,
        0,
        WHOLE_BLOCK,
        r.left + scrollX - (displaced ? displaced.x : 0),
        r.top + scrollY - (displaced ? displaced.y : 0),
        r.width,
        r.height,
      );
      charBoxes.length = 1;
      boundsRef.current = { top: box.top, bottom: box.bottom };
      return;
    }

    const height = layout.lineHeight;
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < lineElsRef.current.length; i++) {
      const el = lineElsRef.current[i];
      if (!el) {
        lineBoxes.push(null);
        continue;
      }
      // The line box never moves -- only its characters are transformed, and a
      // child's transform does not touch its parent's rect.
      const r = el.getBoundingClientRect();
      const left = r.left + scrollX;
      const lineTop = r.top + scrollY;
      lineBoxes.push({
        left,
        top: lineTop,
        right: left + r.width,
        bottom: lineTop + height,
      });
      if (lineTop < top) top = lineTop;
      if (lineTop + height > bottom) bottom = lineTop + height;
    }

    const metas = charMetaRef.current;
    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i];
      const line = lineBoxes[meta.line];
      // SKIP marks a character whose line hasn't mounted yet.
      if (!line) boxAt(charBoxes, i, SKIP, 0, 0, 0, 0);
      else {
        boxAt(
          charBoxes,
          i,
          meta.line,
          line.left + meta.x,
          line.top,
          meta.w,
          height,
        );
      }
    }
    charBoxes.length = metas.length;

    boundsRef.current = lineBoxes.length > 0 ? { top, bottom } : null;
  }, [layout]);

  const apply = useCallback(
    active => {
      const charBoxes = charBoxesRef.current;
      const lineBoxes = lineBoxesRef.current;
      const axes = axesRef.current;
      const applied = appliedRef.current;
      const els = layout ? charElsRef.current : null;

      if (active && charBoxes.length > 0) {
        for (let i = 0; i < charBoxes.length; i++) {
          const box = charBoxes[i];
          if (!box || box.line === SKIP) continue;
          const el = els ? els[box.index] : hostRef.current;
          if (!el) continue;
          // A line the names are nowhere near resolves to nothing for every
          // character on it, so test the line once instead of each character.
          const near =
            box.line === WHOLE_BLOCK || intersectsAny(lineBoxes[box.line]);
          const push = near ? resolveBox(box, axes[box.index]) : REST;
          axes[box.index] = push.axis;

          const x = Math.abs(push.x) > MIN_PUSH ? push.x : 0;
          const y = Math.abs(push.y) > MIN_PUSH ? push.y : 0;
          const prev = applied[box.index];
          if (prev && prev.x === x && prev.y === y) continue;
          applied[box.index] = { x, y };
          el.style.transform =
            x || y ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` : '';
        }
        return;
      }

      // Unmount, simulation over, or the block was skipped as out of band --
      // nothing can be holding it aside, so put every character back.
      for (let i = 0; i < applied.length; i++) {
        const displaced = applied[i];
        if (!displaced || (!displaced.x && !displaced.y)) continue;
        const el = els ? els[i] : hostRef.current;
        if (el) el.style.transform = '';
      }
      applied.length = 0;
      axes.length = 0;
    },
    [layout],
  );

  // An inline box ignores transforms, so anything dodging as a whole block
  // (a heading with markup in it) is nudged to inline-block.
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

  if (!layout) {
    return (
      <Tag ref={hostRef} className={className} style={style} {...rest}>
        {children}
      </Tag>
    );
  }

  let charIndex = 0;
  return (
    <Tag ref={hostRef} className={className} style={style} {...rest}>
      {/* The glyphs on screen carry no text of their own: one element each,
          in reading order but placed by hand. The string itself lives in the
          hidden copy below, where assistive tech and copy/paste find it. */}
      {layout.lines.map((line, i) => (
        <span key={i} className='dodge-line' aria-hidden='true'>
          <span
            className='dodge-line-box'
            style={{ width: line.width, height: layout.lineHeight }}
            ref={el => {
              lineElsRef.current[i] = el;
            }}
          >
            {line.chars.map((char, j) => {
              const index = charIndex++;
              return (
                <span
                  key={j}
                  className='dodge-char'
                  style={{ left: char.x }}
                  ref={el => {
                    charElsRef.current[index] = el;
                  }}
                >
                  {char.ch}
                </span>
              );
            })}
          </span>
        </span>
      ))}
      <span className='dodge-text'>{children}</span>
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
