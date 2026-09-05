import { useCallback, useMemo, useRef } from 'react';
import { THEMES } from './themes.js';

const CELL = 12;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const FEATHER = 7;
const DURATION = 900;

/**
 * The category swap: a stepped disc of the incoming ground colour grows from
 * the toggle across the section.
 *
 * The interesting part is that it does not cover the content. The disc paints
 * only the *background*, and each themed element recolours as the dither front
 * passes it — so the type appears to change in the wake of the sweep rather
 * than being hidden by it.
 *
 * Two details make that work:
 *
 * - An element flips when the front clears its FARTHEST corner, not its
 *   centre. The two palettes are near-inversions, so an element flipped at its
 *   midpoint would spend half the sweep as ultra-on-ultra and disappear.
 * - After the swap commits, every themed element is re-asserted from its
 *   settled `data-t-*` key. React skips a style write when the old and new
 *   values happen to be equal, which would otherwise strand this hook's
 *   imperative colour on those elements permanently.
 *
 * The disc is drawn into one reused ImageData filled monotonically: a cell that
 * has been dithered in never flickers back out, and each frame only visits the
 * growing disc rather than the whole buffer.
 */
export default function useDitherWipe({ canvasRef, paneRef, sectionRef, glyphRef, glyph, onSettled }) {
  const rafRef = useRef(0);

  const run = useCallback(
    (origin, key, from) => {
      const canvas = canvasRef.current;
      const section = paneRef.current;

      const settle = () => {
        const theme = THEMES[key];
        const nodes =
          sectionRef.current?.querySelectorAll(
            '[data-t-color],[data-t-bg],[data-t-border]',
          ) || [];
        for (const el of nodes) {
          if (el.dataset.tColor) el.style.color = theme[el.dataset.tColor];
          if (el.dataset.tBg) el.style.background = theme[el.dataset.tBg];
          if (el.dataset.tBorder) {
            el.style.borderColor = theme[el.dataset.tBorder];
          }
        }
      };

      const commit = () => {
        onSettled(key, () => {
          glyph.current?.setColors(THEMES[key]);
          requestAnimationFrame(settle);
        });
      };

      if (!canvas || !section) {
        commit();
        return;
      }

      const rect = section.getBoundingClientRect();
      const w = Math.max(1, Math.ceil(rect.width / CELL));
      const h = Math.max(1, Math.ceil(rect.height / CELL));
      canvas.width = w;
      canvas.height = h;
      canvas.style.opacity = '1';

      const ctx = canvas.getContext('2d');
      const [cr, cg, cb] = [1, 3, 5].map(i =>
        parseInt(THEMES[key].bg.slice(i, i + 2), 16),
      );
      const ox = origin.x / CELL;
      const oy = origin.y / CELL;
      const maxR = Math.max(
        Math.hypot(ox, oy),
        Math.hypot(w - ox, oy),
        Math.hypot(ox, h - oy),
        Math.hypot(w - ox, h - oy),
      );

      // Measured once: the list content only changes when the swap commits.
      const farthest = (box, r) => {
        const l = r.left - box.left;
        const t = r.top - box.top;
        return Math.max(
          Math.hypot(l - origin.x, t - origin.y),
          Math.hypot(l + r.width - origin.x, t - origin.y),
          Math.hypot(l - origin.x, t + r.height - origin.y),
          Math.hypot(l + r.width - origin.x, t + r.height - origin.y),
        );
      };
      const targets = [
        ...section.querySelectorAll(
          '[data-t-color],[data-t-bg],[data-t-border]',
        ),
      ].map(el => ({
        el,
        reach: farthest(rect, el.getBoundingClientRect()),
        color: el.dataset.tColor,
        bg: el.dataset.tBg,
        border: el.dataset.tBorder,
        on: false,
      }));

      const glyphEl = glyphRef.current;
      const glyphReach = glyphEl
        ? farthest(rect, glyphEl.getBoundingClientRect())
        : null;
      let glyphFlipped = false;

      const img = ctx.createImageData(w, h);
      const d = img.data;
      const start = performance.now();

      const frame = now => {
        const p = Math.min(1, (now - start) / DURATION);
        const radius = maxR * (1 - (1 - p) * (1 - p));
        const x0 = Math.max(0, Math.floor(ox - radius - 1));
        const x1 = Math.min(w - 1, Math.ceil(ox + radius + 1));
        const y0 = Math.max(0, Math.floor(oy - radius - 1));
        const y1 = Math.min(h - 1, Math.ceil(oy + radius + 1));

        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const i = (y * w + x) * 4;
            if (d[i + 3]) continue;
            const edge = (radius - Math.hypot(x - ox, y - oy)) / FEATHER;
            if (edge <= 0) continue;
            if (edge < 1 && edge < (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16) {
              continue;
            }
            d[i] = cr;
            d[i + 1] = cg;
            d[i + 2] = cb;
            d[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);

        // Where coverage is solid rather than feathered.
        const front = radius * CELL - FEATHER * CELL;
        for (const t of targets) {
          const inside = t.reach <= front;
          if (inside === t.on) continue;
          t.on = inside;
          const theme = THEMES[inside ? key : from];
          if (t.color) t.el.style.color = theme[t.color];
          if (t.bg) t.el.style.background = theme[t.bg];
          if (t.border) t.el.style.borderColor = theme[t.border];
        }
        if (glyphReach !== null && !glyphFlipped && glyphReach <= front) {
          glyphFlipped = true;
          glyph.current?.setColors(THEMES[key]);
        }

        if (p < 1) {
          rafRef.current = requestAnimationFrame(frame);
          return;
        }
        rafRef.current = 0;
        commit();
        canvas.style.opacity = '0';
        ctx.clearRect(0, 0, w, h);
      };

      rafRef.current = requestAnimationFrame(frame);
    },
    [canvasRef, paneRef, sectionRef, glyphRef, glyph, onSettled],
  );

  const cancel = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const isRunning = useCallback(() => rafRef.current !== 0, []);

  // Stable identity. Returning a fresh object literal would change on every
  // render, and WorksPane's scroll effect depends on it — the listeners would
  // be torn down and re-added continuously, and the effect's cleanup would
  // cancel any selection update still pending in a requestAnimationFrame.
  return useMemo(() => ({ run, cancel, isRunning }), [run, cancel, isRunning]);
}
