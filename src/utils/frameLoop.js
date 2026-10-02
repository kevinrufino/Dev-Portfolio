/**
 * The one animation loop the page runs on.
 *
 * Every continuous effect — the landing physics, the palm, the works pane, the
 * pixel trail, the cursor and its gravity, the gooey followers — used to run
 * its own `requestAnimationFrame` chain. That is a dozen callbacks the browser
 * schedules separately every frame, each throttling itself, each checking
 * visibility its own way, and with no say over the order they run in (the
 * cursor could draw its aim a frame before cursorFx had worked it out).
 *
 * Now there is exactly one chain. Subscribers register here, say how often
 * they want to run and where in the frame, and the loop only exists while
 * someone is subscribed — an idle page schedules nothing.
 *
 * ORDER. Lower runs first. State that other subscribers read (cursorFx's aim)
 * runs before the things that draw it, and simulation runs before paint.
 *
 * INTERVAL. A subscriber that wants less than every frame says so here rather
 * than counting milliseconds itself. The check allows a millisecond of slack
 * so a 31ms budget on a 16.7ms display lands on every other frame instead of
 * drifting between every second and every third.
 *
 * A subscriber that throws is reported and kept: one broken effect must not
 * take every other animation on the page down with it.
 */

/** Frame-to-frame slack on an interval, in ms. */
const SLACK_MS = 1;

/** @type {Array<{fn: (now: number, dt: number) => void, interval: number, order: number, last: number}>} */
let subscribers = [];
let raf = 0;

const tick = now => {
  raf = 0;
  // Iterate a snapshot: a subscriber may unsubscribe itself (or another) from
  // inside its own callback, and the frame should still finish cleanly.
  const list = subscribers;
  for (let i = 0; i < list.length; i++) {
    const sub = list[i];
    if (!sub.live) continue;
    const dt = sub.last < 0 ? 0 : now - sub.last;
    if (sub.last >= 0 && dt < sub.interval - SLACK_MS) continue;
    sub.last = now;
    try {
      sub.fn(now, dt);
    } catch (error) {
      console.error('frameLoop subscriber failed', error);
    }
  }
  if (subscribers.length > 0) raf = requestAnimationFrame(tick);
};

const ensureRunning = () => {
  if (raf === 0 && subscribers.length > 0) raf = requestAnimationFrame(tick);
};

/**
 * Run `fn` on the shared loop.
 *
 * @param {(now: number, dt: number) => void} fn - called with the frame's
 *   timestamp and the ms since this subscriber last ran (0 on its first run).
 * @param {object} [options]
 * @param {number} [options.interval=0] - minimum ms between runs; 0 is every
 *   frame.
 * @param {number} [options.order=0] - lower runs earlier in the frame.
 * @returns {() => void} unsubscribe. Safe to call more than once.
 */
export function onFrame(fn, { interval = 0, order = 0 } = {}) {
  const sub = { fn, interval, order, last: -1, live: true };
  // Copy-on-write, so a frame already iterating the old array is unaffected.
  subscribers = [...subscribers, sub].sort((a, b) => a.order - b.order);
  ensureRunning();
  return () => {
    if (!sub.live) return;
    sub.live = false;
    subscribers = subscribers.filter(s => s !== sub);
    if (subscribers.length === 0 && raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

/** Frame-order slots, so subscribers agree on where they sit. */
export const FRAME_ORDER = {
  /** Reads input and publishes state others draw from. */
  input: -20,
  /** Steps simulations. */
  simulate: -10,
  /** Default. */
  update: 0,
  /** Paints. */
  draw: 10,
};

/** How many subscribers are live. For tests and the perf harness. */
export const frameSubscriberCount = () => subscribers.length;
