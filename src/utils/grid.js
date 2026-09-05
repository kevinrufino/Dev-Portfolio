/**
 * The page's shared 6px lattice.
 *
 * Several things draw on a 6px grid — the section background rules, the pixel
 * trail's cells, and (later) the palm's raster. They only read as one grid if
 * they agree on where its origin is.
 *
 * A CSS background grid starts at its own element's top-left corner. Sections
 * rarely begin on a multiple of 6 (clamp() padding, a sticky header, a viewport
 * that isn't a round number), so left to itself every section draws a grid a
 * pixel or two out of phase with the one above it — which reads as a seam
 * rather than a grid.
 *
 * `alignGrids` fixes the phase: for each grid element it measures its parent's
 * offset from the document origin and shifts `background-position` by the
 * negative remainder, so the cells land on the same lattice everywhere.
 */
export const GRID = 6;

/**
 * Re-phase every `.grid-rule` element against the document origin.
 *
 * Call on mount, on resize, and after anything that changes section offsets.
 * Reads layout, so call it from a rAF rather than a scroll handler.
 *
 * @param {ParentNode} [root=document] - subtree to align.
 */
export function alignGrids(root = document) {
  const nodes = root.querySelectorAll('.grid-rule');
  for (const el of nodes) {
    const parent = el.parentElement;
    if (!parent) continue;
    const box = parent.getBoundingClientRect();
    const top = box.top + window.scrollY;
    const left = box.left;
    el.style.backgroundPosition = `${-mod(left, GRID)}px ${-mod(top, GRID)}px`;
  }
}

/** Positive modulo — `-1 % 6` is `-1` in JS, and we need `5`. */
const mod = (value, n) => ((value % n) + n) % n;

/**
 * Keep the lattice aligned for the lifetime of a component.
 *
 * Returns a teardown, so it drops straight into a `useEffect`.
 *
 * @param {ParentNode} [root=document]
 * @returns {() => void} teardown
 */
export function watchGrids(root = document) {
  let frame = requestAnimationFrame(() => alignGrids(root));
  const onResize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => alignGrids(root));
  };
  window.addEventListener('resize', onResize);
  // Fonts landing changes section heights, which moves every grid below them.
  document.fonts?.ready.then(() => onResize());
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
  };
}
