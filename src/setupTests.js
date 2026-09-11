// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

/**
 * The observers jsdom does not implement.
 *
 * Several components on this site observe intersection or size — the count-up
 * figures, the works pane, the footer's published height. jsdom ships neither
 * API, so rendering any of them threw `IntersectionObserver is not defined`
 * before a single assertion ran, which is what had App.test.js failing.
 *
 * These are deliberately inert rather than simulated: a stub that never fires
 * leaves whatever the component rendered on its own, which is exactly the state
 * these tests are about — the page before anything has scrolled into view. A
 * test that wants the observed behaviour should drive it explicitly, the way
 * RollingNumber.test.js does.
 */
class InertObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (!global.IntersectionObserver) global.IntersectionObserver = InertObserver;
if (!global.ResizeObserver) global.ResizeObserver = InertObserver;

/**
 * `window.matchMedia`, which jsdom also omits.
 *
 * The site asks it two questions — whether the pointer is fine, and whether the
 * reader has asked for less motion — and answers both by not drawing something.
 * `matches: false` everywhere is the honest default for a test environment that
 * has no pointer and no preference, and it is what a component should cope with.
 * Tests that need a specific answer replace this wholesale.
 */
if (!window.matchMedia) {
  window.matchMedia = query => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

/**
 * A 2D canvas context, which jsdom provides only as `null`.
 *
 * This site draws a lot: the cursor field, the pixel trail, the glyph study, the
 * dither curtain. None of them assert anything about their pixels in a test —
 * they just have to be able to run without the first `fillStyle =` throwing and
 * taking the render down with it.
 *
 * So this records nothing and returns empty pixels. It is scaffolding to let
 * components mount, not a canvas implementation, and any test that wants to make
 * a claim about drawing should stub its own.
 */
if (!HTMLCanvasElement.prototype.getContext.__stub) {
  const noop = () => {};
  const context = () => ({
    canvas: null,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    save: noop, restore: noop, scale: noop, rotate: noop, translate: noop,
    transform: noop, setTransform: noop, resetTransform: noop,
    clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    arcTo: noop, rect: noop, ellipse: noop, bezierCurveTo: noop,
    quadraticCurveTo: noop, fill: noop, stroke: noop, clip: noop,
    drawImage: noop, fillText: noop, strokeText: noop,
    putImageData: noop, setLineDash: noop, createPattern: () => null,
    measureText: () => ({ width: 0 }),
    getImageData: (x, y, w = 1, h = 1) => ({
      width: w, height: h, data: new Uint8ClampedArray(w * h * 4),
    }),
    createImageData: (w = 1, h = 1) => ({
      width: w, height: h, data: new Uint8ClampedArray(w * h * 4),
    }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
  });
  const getContext = type => (type === '2d' ? context() : null);
  getContext.__stub = true;
  HTMLCanvasElement.prototype.getContext = getContext;
}

/**
 * The Font Loading API. jsdom has no `document.fonts` at all, and the landing
 * sequence waits on `document.fonts.ready` to decide when the page is ready
 * enough to hand off. An already-resolved promise is the right answer here: in
 * a test there are no webfonts to wait for.
 */
if (!document.fonts) {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve(), load: () => Promise.resolve([]),
             check: () => true, add: () => {}, forEach: () => {} },
  });
}
