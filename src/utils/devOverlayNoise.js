/**
 * Keep one benign browser notice out of the development error overlay.
 *
 * "ResizeObserver loop completed with undelivered notifications" is not an
 * exception, and nothing in this codebase throws it. It is the ResizeObserver
 * spec's own back-pressure notice: when an observer's callback changes layout,
 * the browser re-runs the observation, and if that has not settled by the end of
 * the frame it delivers what it has and reports the rest on the next one. The
 * remaining notifications are delivered — "undelivered" here means deferred, not
 * lost — so nothing is dropped and nothing is broken.
 *
 * It reaches the screen only because Create React App's overlay treats every
 * window `error` event as fatal and paints a red page over the app, and Chrome
 * emits this one as a window error. So a notice with no consequence looks
 * exactly like a crash. A production build has no overlay: this is a
 * development-only annoyance with a development-only cause.
 *
 * ── where it comes from here ────────────────────────────────────────────────
 *
 * Nothing in `src/` constructs a ResizeObserver on a project page. That was
 * verified rather than assumed — patching the constructor and remounting the
 * whole route caught none. The observers belong to framer-motion (the
 * `AnimatePresence` wrapping the routes) and @react-spring, both mounted once at
 * app start. Closing the media lightbox restores `body`'s overflow and the
 * scrollbar-width padding it was holding, and that is a real width change for
 * those observers to notice. The work is correct; it just sometimes does not fit
 * in one frame.
 *
 * ── why this is done by wrapping the constructor ────────────────────────────
 *
 * The obvious approach — listen for the error and call `stopImmediatePropagation`
 * before the overlay sees it — cannot work, and it is worth writing down so it
 * is not tried again. The event is dispatched AT `window`, so every listener on
 * `window` is in the target phase, and in the target phase listeners run in
 * registration order and the capture flag is ignored. The dev-server client
 * registers before this bundle is evaluated, so its listener always runs first.
 * (Tried, observed, reverted.)
 *
 * Deferring each callback by a frame instead means the observation cycle always
 * settles, so the browser never has cause to emit the notice. The cost is that
 * every ResizeObserver callback runs one frame later than it otherwise would —
 * which is why this is scoped to development. Production keeps the native timing
 * and simply logs a harmless notice to a console nobody has open.
 */

export default function silenceResizeObserverNoise() {
  if (process.env.NODE_ENV !== 'development') return;
  const Native = window.ResizeObserver;
  if (!Native || Native.__deferred) return;

  class DeferredResizeObserver extends Native {
    constructor(callback) {
      let frame = 0;
      super((entries, observer) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => callback(entries, observer));
      });
    }
  }
  DeferredResizeObserver.__deferred = true;
  window.ResizeObserver = DeferredResizeObserver;
}
