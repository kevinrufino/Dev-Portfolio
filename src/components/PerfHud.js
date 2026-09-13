import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { hasFinePointer } from '../utils/pointerKind.js';

/**
 * A frame-rate readout you can open on the device that feels slow.
 *
 * This exists because the machine diagnosing the site is not the machine
 * running it. "The physics feel like a low frame rate on my iPhone" is the only
 * report that matters and the hardest one to act on: a headless Chrome does not
 * produce real frames, so its rAF fires ~8 times a second no matter how fast
 * the page is, and every frame-rate number it reports is a measurement of the
 * harness rather than of the site. Guessing from code structure gets you to a
 * shortlist and no further.
 *
 * So the measurement moves to the phone. Open any page with `?perf=1` and this
 * reports what that device is actually doing — worst frame, how many frames
 * blew the 60fps budget, how much canvas is allocated and at what pixel ratio.
 *
 * It is deliberately cheap: one rAF that only writes state four times a second,
 * no layout reads, no canvas. Measuring hard enough to change the answer is the
 * classic way to get a wrong one.
 */

const PARAM = 'perf';
const REPORT_MS = 250;
const WINDOW = 180; // frames kept for percentiles — about three seconds

const PerfHud = () => {
  const { search } = useLocation();
  const on = new URLSearchParams(search).get(PARAM) === '1';
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!on) return undefined;

    const frames = [];
    let longTasks = 0;
    let longTaskMs = 0;
    let raf = 0;
    let last = performance.now();
    let reportedAt = last;

    let observer = null;
    try {
      observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          longTasks += 1;
          longTaskMs += entry.duration;
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Safari has no longtask observer. The frame numbers still work, which
      // is the half that matters on the device this was written for.
    }

    const tick = now => {
      raf = requestAnimationFrame(tick);
      const delta = now - last;
      last = now;
      frames.push(delta);
      if (frames.length > WINDOW) frames.shift();
      if (now - reportedAt < REPORT_MS) return;
      reportedAt = now;

      const sorted = [...frames].sort((a, b) => a - b);
      const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
      let canvasPixels = 0;
      const canvases = document.querySelectorAll('canvas');
      for (const c of canvases) canvasPixels += c.width * c.height;

      setStats({
        fps: Math.round(1000 / mean),
        p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] || 0),
        worst: Math.round(sorted[sorted.length - 1] || 0),
        janky: frames.filter(f => f > 20).length,
        of: frames.length,
        longTasks,
        longTaskMs: Math.round(longTaskMs),
        canvases: canvases.length,
        megapixels: (canvasPixels / 1e6).toFixed(1),
        dpr: window.devicePixelRatio,
        pointer: hasFinePointer() ? 'fine' : 'coarse',
      });
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [on]);

  if (!on || !stats) return null;

  const bad = stats.fps < 50;
  return (
    <div
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 9997,
        padding: '8px 10px',
        borderRadius: 6,
        background: 'rgba(12,12,16,.86)',
        color: bad ? '#ff8d6b' : '#9dff8d',
        font: '600 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
        pointerEvents: 'none',
        whiteSpace: 'pre',
        letterSpacing: '.02em',
      }}
    >
      {`${stats.fps} fps   p95 ${stats.p95}ms   worst ${stats.worst}ms
janky ${stats.janky}/${stats.of} frames >20ms
long tasks ${stats.longTasks} (${stats.longTaskMs}ms)
canvas ${stats.canvases} · ${stats.megapixels}MP · dpr ${stats.dpr}
pointer ${stats.pointer}`}
    </div>
  );
};

export default PerfHud;
