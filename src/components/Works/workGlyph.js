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
 * A project may bring its own loop instead of taking one of the three shapes.
 * It is not shown as video: it is sampled into the same 88x88 luminance field
 * and comes out as the same dithered type, so a two-tone loop reads as the
 * glyph moving rather than as a clip playing inside it. That is the whole
 * reason the field is a separate step from the render — anything that can
 * fill 88x88 floats is a glyph here.
 *
 * Framework-free on purpose: it owns a canvas and nothing else. WorksPane
 * drives `paint` from its own throttled loop rather than running one here.
 */
const N = 88;
const CHARS = '·:+=*#%@';
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * A loop, sampled down to the glyph's own resolution.
 *
 * One 88x88 scratch canvas per source, cover-fitted, read back as luminance.
 * `drawImage` does the scaling, so a 1080p loop costs the same as a 240p one,
 * and the read is 7,744 pixels — small enough to do every frame the pane
 * paints without a worker.
 *
 * Muted, looping, inline and `autoplay`: the only combination browsers will
 * start without a gesture. If it refuses to play the field stays empty and the
 * caller falls back to the generative shape, so a blocked video is a missing
 * glyph rather than a broken one.
 *
 * The element is never added to the document. It does not need to be: a
 * detached, playing video decodes and hands `drawImage` a current frame just
 * the same, so the page's DOM stays as it was.
 */
function createLoopSampler(src) {
  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'auto';
  const scratch = document.createElement('canvas');
  scratch.width = N;
  scratch.height = N;
  const sc = scratch.getContext('2d', { willReadFrequently: true });
  const out = new Float32Array(N * N);
  let broken = false;

  video.addEventListener('error', () => {
    broken = true;
  });
  const play = video.play();
  if (play?.catch) play.catch(() => {});

  return {
    /** @returns {Float32Array|null} the frame as luminance, or null if unready. */
    read() {
      if (broken || video.readyState < 2 || !video.videoWidth) return null;
      // Cover, not contain: the glyph frame is square and a letterboxed loop
      // would put two dead bands of dither on either side of it.
      const scale = Math.max(N / video.videoWidth, N / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      sc.drawImage(video, (N - width) / 2, (N - height) / 2, width, height);
      const { data } = sc.getImageData(0, 0, N, N);
      for (let i = 0; i < out.length; i++) {
        const p = i * 4;
        // Rec. 601 luma. The source is meant to be two-tone, so this mostly
        // just decides which of the two each pixel is.
        out[i] =
          (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255;
      }
      return out;
    },
    destroy() {
      video.pause();
      video.removeAttribute('src');
      video.load();
    },
  };
}

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
  // One sampler per source, kept across selections: switching back to a
  // project should not restart its loop from a black first frame.
  const loops = new Map();

  const loopFor = src => {
    if (!src) return null;
    if (!loops.has(src)) loops.set(src, createLoopSampler(src));
    return loops.get(src);
  };

  const field = time => {
    const frame = loopFor(item?.glyphSrc)?.read();
    if (frame) return frame;
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
    destroy() {
      for (const loop of loops.values()) loop.destroy();
      loops.clear();
    },
    setColors(next) {
      colors = { glyphInk: next.glyphInk, glyphBg: next.glyphBg };
      paint(performance.now());
    },
  };
}
