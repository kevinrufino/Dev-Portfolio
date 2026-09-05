/**
 * The glyph study — a generative stand-in for each project.
 *
 * An 88x88 luminance field rendered as ASCII characters through a 4x4 Bayer
 * threshold, so the form reads as dithered type rather than as an image. Each
 * project maps to one of three shapes; switching cross-fades the two fields
 * over ~260ms rather than cutting.
 *
 * Deliberately not a screenshot. The pane shows one project at a time in a
 * fixed viewport, and a video thumbnail at that size competes with the list
 * for attention; one evolving form doesn't.
 *
 * Framework-free on purpose: it owns a canvas and nothing else. WorksPane
 * drives `paint` from its own throttled loop rather than running one here.
 */
const N = 88;
const CHARS = '·:+=*#%@';
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function createWorkGlyph(canvas) {
  const ac = canvas.getContext('2d');
  canvas.width = 640;
  canvas.height = 640;
  let item = null;
  let displayed = new Float32Array(N * N);
  let from = null;
  let morphStart = 0;
  let paused = false;
  let colors = { glyphInk: '#f1f43b', glyphBg: '#111125' };

  const field = time => {
    const f = new Float32Array(N * N);
    const t = paused ? 0 : time * 0.0003;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = (x - 44) / 32;
        const dy = (y - 44) / 32;
        const u = dx * Math.cos(t) - dy * Math.sin(t);
        const v = dx * Math.sin(t) + dy * Math.cos(t);
        let value = 0;
        if (item && item.shape === 'poster') {
          if (Math.abs(u) < 0.72 && Math.abs(v) < 1) value = 0.4 + 0.6 * (Math.sin(v * 9 + t * 4) * 0.5 + 0.5);
        } else if (item && item.shape === 'sphere') {
          const d = dx * dx + dy * dy;
          if (d < 1) value = Math.max(0.08, Math.sqrt(1 - d) * 0.8 + dx * 0.3);
        } else {
          const r = Math.hypot(u * 1.1, v * 0.85);
          if (r > 0.4 && r < 1) value = 0.35 + 0.65 * (Math.sin(Math.atan2(v, u) * 3 + t * 3) * 0.5 + 0.5);
        }
        f[y * N + x] = value;
      }
    }
    return f;
  };

  function paint(time) {
    const target = field(time);
    const p = from ? Math.min(1, (time - morphStart) / 262.5) : 1;
    const ease = p * p * (3 - 2 * p);
    ac.clearRect(0, 0, 640, 640);
    ac.font = 'bold 8px monospace';
    ac.textAlign = 'center';
    ac.textBaseline = 'middle';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const value = from ? from[i] * (1 - ease) + target[i] * ease : target[i];
        displayed[i] = value;
        if (value < 0.06) continue;
        const threshold = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        ac.fillStyle = value > threshold * 0.8 ? colors.glyphInk : colors.glyphBg;
        ac.fillText(CHARS[Math.min(7, Math.floor(value * 8))], x * 7 + 15, y * 7 + 15);
      }
    }
    if (p === 1) from = null;
  }

  return {
    paint,
    setItem(next) {
      if (next === item) return;
      from = paused ? null : displayed.slice();
      morphStart = performance.now();
      item = next;
      paint(performance.now());
    },
    setPaused(value) { paused = value; },
    setColors(next) {
      colors = { glyphInk: next.glyphInk, glyphBg: next.glyphBg };
      paint(performance.now());
    },
  };
}
