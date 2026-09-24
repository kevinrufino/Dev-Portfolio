/**
 * Scenarios — the moments on the site worth defending.
 *
 * Each scenario is: navigate, let it settle, reset the counters, then do
 * something for a fixed window while the instruments run. The settle step is
 * the important one — measuring from `load` folds bundle parse and React mount
 * into the frame rate, which makes every number a page-load number and hides
 * steady-state regressions.
 *
 * `landing` is the deliberate exception: there, the load IS the thing being
 * measured.
 *
 * Interactions use real input (`page.mouse`) rather than `window.scrollTo` or
 * synthetic events, so scroll-linked and pointer-driven code paths actually
 * run. A scenario that drives the page with `dispatchEvent` measures a page
 * nobody is using.
 */

const settle = (page, ms) => page.waitForTimeout(ms);

/** Wheel down the page in human-sized increments for `ms`. */
const wheelFor = async (page, ms, dy = 120) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(50);
  }
};

/** Sweep the pointer across the viewport — drives cursorFx and PixelTrail. */
const sweepPointer = async (page, ms, vp) => {
  const until = Date.now() + ms;
  let i = 0;
  while (Date.now() < until) {
    const t = (i++ % 40) / 40;
    await page.mouse.move(
      Math.round(vp.width * (0.1 + 0.8 * t)),
      Math.round(vp.height * (0.3 + 0.4 * Math.sin(t * Math.PI * 2))),
      { steps: 3 },
    );
    await page.waitForTimeout(16);
  }
};

export const SCENARIOS = {
  landing: {
    label: 'landing sequence (load → names drained)',
    why: 'The heaviest moment on the site: bundle parse, React mount, matter-js '
      + 'bodies dropping, and the palm raster all at once. If anything is going '
      + 'to drop frames it is here.',
    path: '/',
    settleMs: 0,          // measure from first paint on purpose
    windowMs: 6000,
    run: async () => {},
  },

  'home-idle': {
    label: 'home, settled, untouched',
    why: 'Steady-state cost of the page doing nothing: the palm scene repaint '
      + 'and whatever rAF loops stayed running after the landing finished. A '
      + 'page that cannot idle cheaply drains a phone battery in a pocket.',
    path: '/',
    settleMs: 7000,
    windowMs: 5000,
    run: async () => {},
  },

  'home-scroll': {
    label: 'home, scrolled top to bottom',
    why: 'Scroll is the interaction every visitor performs. Exercises the '
      + 'scroll-linked reveals, the works uncover, and the palm skip window.',
    path: '/',
    settleMs: 7000,
    windowMs: 6000,
    run: (page) => wheelFor(page, 6000),
  },

  'works-pane': {
    label: 'works pane, scrolled and hovered',
    why: 'The works list is the densest DOM on the page and the part with the '
      + 'most hover state. Regressions in the dither wipe land here.',
    path: '/',
    settleMs: 7000,
    windowMs: 6000,
    run: async (page, { viewport }) => {
      await wheelFor(page, 2500, 240);          // get down to the works section
      await sweepPointer(page, 3500, viewport); // then hover across the rows
    },
  },

  'pointer-sweep': {
    label: 'pointer swept across the home page',
    why: 'The cursor machinery — gravity fields, the pixel trail, the pointer '
      + 'rAF loop — only runs on a fine pointer, so it is invisible in every '
      + 'mobile profile. This is the scenario that guards it.',
    path: '/',
    settleMs: 7000,
    windowMs: 5000,
    desktopOnly: true,
    run: (page, { viewport }) => sweepPointer(page, 5000, viewport),
  },

  'project-page': {
    label: 'project page, loaded and scrolled',
    why: 'Media-heavy route: posters, autoplaying clips, and the chapter '
      + 'observer. Guards the asset budget as much as the frame budget.',
    path: '/projects/swoosh-404',
    settleMs: 4000,
    windowMs: 6000,
    run: (page) => wheelFor(page, 6000, 200),
  },
};

export const DEFAULT_SCENARIOS = Object.keys(SCENARIOS);
