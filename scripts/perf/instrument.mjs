/**
 * The measurement code, injected into the page before anything else runs.
 *
 * Four independent instruments, because any one of them can lie:
 *
 *   rAF deltas      — what the page thinks its frame rate is. Wrong whenever the
 *                     browser is not actually producing frames (a backgrounded
 *                     tab reports a confident, useless 1Hz).
 *   long tasks      — main-thread blocks over 50ms. Real, but says nothing about
 *                     whether a frame was missed.
 *   LoAF            — long-animation-frame entries. The best of the four: real
 *                     animation frames, with blocking time AND attribution to
 *                     the script that caused it. Chrome 123+.
 *   rAF callback ms — how long the page's own animation work takes per frame,
 *                     measured by wrapping requestAnimationFrame. Independent of
 *                     whether the compositor draws, so it survives environments
 *                     where the other three go quiet.
 *
 * The orchestrator cross-checks these against a painted-frame count taken over
 * CDP, which the page cannot influence at all.
 */
export const INSTRUMENT = `
window.__perf = {
  frames: [], longTasks: [], loaf: [], cbMs: [],
  started: performance.now(),
};

(() => {
  let last = performance.now();
  const tick = now => {
    window.__perf.frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Wrap rAF so every callback the page schedules is timed. This is the page's
  // own animation cost, separate from whether a frame was painted.
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = fn => raf(t => {
    const s = performance.now();
    try { fn(t); } finally { window.__perf.cbMs.push(performance.now() - s); }
  });

  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) window.__perf.longTasks.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  } catch {}

  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) {
        window.__perf.loaf.push({
          duration: Math.round(e.duration),
          blocking: Math.round(e.blockingDuration || 0),
          scripts: (e.scripts || []).slice(0, 3).map(s => ({
            name: (s.sourceURL || s.invoker || '?').split('/').pop().slice(0, 48),
            dur: Math.round(s.duration),
            // Offset into the built file. The harness maps it back to a source
            // line — see symbolicate.mjs. Without this, attribution says
            // "main.<hash>.js", which is every line of the app at once.
            pos: typeof s.sourceCharPosition === 'number' ? s.sourceCharPosition : -1,
            fn: (s.sourceFunctionName || '').slice(0, 40),
            via: (s.invokerType || '').slice(0, 32),
          })),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
})();

// Reset marks where the measurement window begins; it does NOT discard what
// came before. The boot phase is where the long frames actually are, and a
// harness that throws them away reports "0ms blocking" for a page running at
// 23fps — which is true of the window and deeply misleading about the page.
window.__perfReset = () => {
  const p = window.__perf;
  p.mark = {
    frames: p.frames.length,
    longTasks: p.longTasks.length,
    loaf: p.loaf.length,
    cbMs: p.cbMs.length,
    at: performance.now(),
  };
  p.started = performance.now();
};

window.__perfRead = () => {
  const p = window.__perf;
  const mark = p.mark || { frames: 0, longTasks: 0, loaf: 0, cbMs: 0, at: 0 };
  const sinceMark = (a, k) => a.slice(mark[k]);
  const stat = a => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const sum = a.reduce((x, y) => x + y, 0);
    const at = q => +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(2);
    return {
      n: a.length, mean: +(sum / a.length).toFixed(2),
      p50: at(0.5), p95: at(0.95), p99: at(0.99), worst: +s[s.length - 1].toFixed(2),
    };
  };
  const frames = sinceMark(p.frames, 'frames');
  const longTasks = sinceMark(p.longTasks, 'longTasks');
  const loafWin = sinceMark(p.loaf, 'loaf');
  const f = stat(frames);
  const canvases = [...document.querySelectorAll('canvas')];
  // The worst offender by total blocking time, so a regression names a culprit
  // rather than just a number.
  // Group by call site, not by file: "main.js took 1121ms" names nothing,
  // "this offset in main.js took 1121ms" resolves to a source line.
  const bySite = {};
  for (const e of p.loaf) for (const s of e.scripts) {
    const k = s.name + '#' + s.pos;
    bySite[k] = bySite[k] || { name: s.name, pos: s.pos, fn: s.fn, via: s.via, ms: 0, hits: 0 };
    bySite[k].ms += s.dur;
    bySite[k].hits += 1;
  }
  const top = Object.values(bySite).sort((a, b) => b.ms - a.ms).slice(0, 5);
  return {
    windowMs: Math.round(performance.now() - p.started),
    frame: f,
    fps: f ? +(1000 / f.mean).toFixed(1) : null,
    janky20: frames.filter(x => x > 20).length,
    janky50: frames.filter(x => x > 50).length,
    longTasks: { count: longTasks.length, totalMs: longTasks.reduce((a, b) => a + b, 0) },
    // In-window blocking. Often legitimately zero on a page that is uniformly
    // slow rather than spiky — read it next to \`boot\` below, not alone.
    loaf: {
      count: loafWin.length,
      totalBlockingMs: loafWin.reduce((a, b) => a + b.blocking, 0),
      worstMs: loafWin.reduce((a, b) => Math.max(a, b.duration), 0),
      topScripts: top,
    },
    // Everything since navigation start, window included. This is where the
    // bundle-parse and mount cost shows up.
    boot: {
      loafCount: p.loaf.length,
      loafBlockingMs: p.loaf.reduce((a, b) => a + b.blocking, 0),
      loafWorstMs: p.loaf.reduce((a, b) => Math.max(a, b.duration), 0),
      longTaskCount: p.longTasks.length,
      longTaskMs: p.longTasks.reduce((a, b) => a + b, 0),
    },
    callbackMs: stat(sinceMark(p.cbMs, 'cbMs')),
    canvases: canvases.length,
    canvasMegapixels: +(canvases.reduce((s, c) => s + c.width * c.height, 0) / 1e6).toFixed(2),
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
};
`;
