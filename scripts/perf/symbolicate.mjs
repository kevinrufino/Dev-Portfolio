/**
 * Resolve minified LoAF attribution back to source files.
 *
 * Long-animation-frame entries name the script that blocked as
 * `main.b67c7bd5.js` with a character offset. That is true and useless — every
 * line of the app is in that file. This maps the offset back through the build's
 * source map so a regression reads `Palm/PalmScene.js:142` instead.
 *
 * The VLQ decoder is inlined rather than pulled from a package: this runs once
 * per report against maps we just built ourselves, and a dev-only script should
 * not add a dependency for forty lines of arithmetic.
 */
import fs from 'node:fs';
import path from 'node:path';

const B64 = new Map(
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/']
    .map((c, i) => [c, i]),
);

/** Decode one comma-separated VLQ segment into signed ints. */
const decodeVLQ = (segment) => {
  const out = [];
  let shift = 0, value = 0;
  for (const ch of segment) {
    const digit = B64.get(ch);
    if (digit === undefined) return out;
    value += (digit & 31) << shift;
    if (digit & 32) { shift += 5; continue; }
    const negative = value & 1;
    value >>= 1;
    out.push(negative ? (value === 0 ? -0x80000000 : -value) : value);
    shift = 0; value = 0;
  }
  return out;
};

/**
 * Parse a source map into a flat, sorted list of
 * `{ genLine, genCol, source, srcLine }`.
 */
const parseMap = (raw) => {
  const map = JSON.parse(raw);
  const rows = [];
  let srcIdx = 0, srcLine = 0, srcCol = 0;
  map.mappings.split(';').forEach((line, genLine) => {
    let genCol = 0;
    for (const seg of line.split(',')) {
      if (!seg) continue;
      const f = decodeVLQ(seg);
      genCol += f[0];
      if (f.length >= 4) {
        srcIdx += f[1]; srcLine += f[2]; srcCol += f[3];
        rows.push({ genLine, genCol, source: map.sources[srcIdx], srcLine: srcLine + 1 });
      }
    }
  });
  return rows;
};

/** Cache per build file — a report resolves dozens of positions per map. */
const cache = new Map();

const load = (buildDir, fileName) => {
  if (cache.has(fileName)) return cache.get(fileName);
  const js = path.join(buildDir, 'static/js', fileName);
  const mapFile = `${js}.map`;
  let entry = null;
  if (fs.existsSync(js) && fs.existsSync(mapFile)) {
    const code = fs.readFileSync(js, 'utf8');
    // Character offset -> line/column needs the generated file's line breaks.
    const lineStarts = [0];
    for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1);
    entry = { lineStarts, rows: parseMap(fs.readFileSync(mapFile, 'utf8')) };
  }
  cache.set(fileName, entry);
  return entry;
};

/**
 * @param {string} buildDir  the `build/` directory the map lives under
 * @param {string} fileName  e.g. "main.b67c7bd5.js"
 * @param {number} charPos   `sourceCharPosition` from a LoAF script entry
 * @returns {string|null}    e.g. "src/components/Palm/PalmScene.js:142"
 */
export const symbolicate = (buildDir, fileName, charPos) => {
  const entry = load(buildDir, fileName);
  if (!entry || typeof charPos !== 'number' || charPos < 0) return null;

  // Offset -> generated line/column.
  let lo = 0, hi = entry.lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (entry.lineStarts[mid] <= charPos) lo = mid; else hi = mid - 1;
  }
  const genLine = lo;
  const genCol = charPos - entry.lineStarts[lo];

  // Last mapping at or before that position on the same line.
  let best = null;
  for (const r of entry.rows) {
    if (r.genLine !== genLine) continue;
    if (r.genCol > genCol) break;
    best = r;
  }
  if (!best) return null;
  const src = best.source.replace(/^webpack:\/\/[^/]*\//, '').replace(/^\.\//, '');
  // node_modules frames name the library, which is the useful part.
  return `${src}:${best.srcLine}`;
};
