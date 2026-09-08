#!/usr/bin/env node
/**
 * Posterise the project cursors into glyph loops.
 *
 *   node scripts/posterize-cursors.mjs      (run from public/cursors)
 *
 * Reads every GIF beside it and writes `levels/<name>-L<n>.webm` for n in
 * 2..6: the same clip reduced to exactly that many tones, at the 88px the
 * glyph study samples at. Re-runnable — it clears `levels/` first.
 *
 * Three decisions in here are the difference between a usable asset and a
 * broken one, and each is explained at the point it is made: scaling before
 * posterising, stretching from the subject's own range rather than the
 * frame's, and reserving the darkest level for "nothing here".
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.cwd();
const OUT = path.join(SRC, 'levels');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const N = 88;                       // the glyph's own field
const LEVELS = [2, 3, 4, 5, 6];

const probe = (file, entries) =>
  execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', entries, '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();

const report = [];

for (const file of fs.readdirSync(SRC).filter(f => f.endsWith('.gif'))) {
  const name = file.replace(/\.gif$/, '');
  const fps = probe(file, 'stream=avg_frame_rate');

  // Decode to RGBA at the glyph's resolution. Scaled BEFORE posterising, with
  // area averaging: the sampler draws an 88px source 1:1, so levels laid down
  // here survive into the glyph exactly instead of being blurred back into
  // greys by a downscale later.
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file,
    '-vf', `scale=${N}:${N}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 1 << 28 });

  const per = N * N * 4;
  const frames = raw.length / per;

  // The subject's own luma range, measured across the whole clip and over
  // OPAQUE pixels only. Transparent areas composite to black, so including
  // them would peg the minimum at 0 and there would be nothing to stretch.
  let lo = 255, hi = 0, opaque = 0;
  for (let i = 0; i < raw.length; i += 4) {
    if (raw[i + 3] < 128) continue;
    opaque++;
    const y = 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2];
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  const span = Math.max(1, hi - lo);
  const clear = 1 - opaque / (raw.length / 4);

  for (const levels of LEVELS) {
    const out = Buffer.alloc(N * N * frames);
    const hist = new Array(levels).fill(0);
    for (let p = 0, o = 0; p < raw.length; p += 4, o++) {
      let k = 0;
      if (raw[p + 3] >= 128) {
        const y = 0.299 * raw[p] + 0.587 * raw[p + 1] + 0.114 * raw[p + 2];
        const t = Math.min(1, Math.max(0, (y - lo) / span));
        // Level 0 is reserved for "nothing here" — the glyph skips it. The
        // subject is stretched across 1..levels-1 so its darkest tone still
        // reads as ink rather than dropping out into the background.
        k = Math.round(t * (levels - 2)) + 1;
      }
      hist[k]++;
      out[o] = Math.round((k / (levels - 1)) * 255);
    }
    const dest = path.join(OUT, `${name}-L${levels}.webm`);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'gray',
      '-s', `${N}x${N}`, '-r', fps, '-i', 'pipe:0',
      // VP9, lossless, and both halves of that are load-bearing.
      //
      // Lossless because anything less puts the greys back: x264 at crf 6 rang
      // at the hard edges badly enough to turn a two-tone clip into five
      // tones, and even at qp 1 with deblocking off it produced seventeen
      // levels where there should have been six. Quantisation is exactly what
      // this pass exists to control, so the encoder cannot be allowed a say.
      //
      // VP9 rather than h264 because lossless h264 is only expressible in High
      // 4:4:4 Predictive, which browsers do not decode in a <video> — the file
      // would be perfect and unplayable. VP9 lossless stays in Profile 0.
      '-c:v', 'libvpx-vp9', '-lossless', '1',
      '-pix_fmt', 'yuv420p', '-y', dest],
      { input: out });
    if (levels === 6) {
      report.push({ name, frames, fps, lo: Math.round(lo), hi: Math.round(hi),
                    clear: `${Math.round(clear * 100)}%`,
                    used: hist.filter(Boolean).length });
    }
  }
  console.log(`${name.padEnd(22)} ${frames} frames @ ${fps}  luma ${Math.round(lo)}–${Math.round(hi)}  clear ${Math.round(clear * 100)}%`);
}
console.log('\nwrote', fs.readdirSync(OUT).length, 'files to public/cursors/levels/');
