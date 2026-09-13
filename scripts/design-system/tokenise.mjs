#!/usr/bin/env node
/**
 * Replace hard-coded colour literals with design tokens.
 *
 *   node scripts/design-system/tokenise.mjs --dry     # show every edit, change nothing
 *   node scripts/design-system/tokenise.mjs           # apply
 *
 * Three substitutions, each only where the value has a token:
 *
 *   Tailwind    text-[#dcddd7]  ->  text-page-body
 *   CSS         color: #a8a9a3  ->  color: var(--colour-page-muted)
 *   JS string   '#F1F43B'       ->  colour.acid      (import added)
 *
 * ## What it deliberately leaves alone
 *
 * `src/components/Palm/palmEngine.js` — the palm's fifteen colours are a
 * sprite ramp, artwork rather than interface. Naming them `colour.*` would
 * imply a designer can retune them from Figma without looking at the palm,
 * which is not true.
 *
 * `src/pages/studio.css`, `src/components/Project/edit/edit.css` — the content
 * editor's own chrome. It is unlinked internal tooling on a separate dark
 * palette, and pulling it into the published system would put twenty colours no
 * visitor ever sees into the design file.
 *
 * `src/components/CursorFxDebug.js` — a debug overlay behind `?edit`. Its
 * magenta is meant to be obviously not part of the design.
 *
 * Those three exclusions are the difference between a design system and a
 * find-and-replace.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DRY = process.argv.includes('--dry');

const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/styles/tokens.json'), 'utf8')).colour;
/** hex -> token name. Lower-cased keys; CSS and Tailwind both write lowercase. */
const BY_HEX = Object.fromEntries(
  Object.entries(tokens).map(([name, v]) => [String(v.value ?? v).toLowerCase(), name]),
);

const EXCLUDE = [
  'src/styles/tokens.css',
  'src/styles/tokens.json',
  'src/components/Palm/palmEngine.js',
  'src/pages/studio.css',
  'src/components/Project/edit/edit.css',
  'src/components/CursorFxDebug.js',
];

/** camelCase identifier for a token name: `on-acid-ink` -> `colour['on-acid-ink']`. */
const jsRef = (name) => (/^[a-z][a-zA-Z0-9]*$/.test(name) ? `colour.${name}` : `colour['${name}']`);

const files = execSync(
  "grep -rlE '#[0-9A-Fa-f]{6}' src --include='*.js' --include='*.css' || true",
  { cwd: ROOT, encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
  .filter(f => !EXCLUDE.includes(f) && !f.endsWith('.test.js'));

const edits = [];

for (const rel of files) {
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  const isCss = rel.endsWith('.css');
  let usedJsToken = false;

  if (isCss) {
    // Bare hex in a declaration. `var(--acid, #f1f43b)` fallbacks are rewritten
    // too — the fallback is a second copy of the same value by definition.
    src = src.replace(/#[0-9A-Fa-f]{6}\b/g, (hex) => {
      const name = BY_HEX[hex.toLowerCase()];
      if (!name) return hex;
      edits.push({ rel, from: hex, to: `var(--colour-${name})` });
      return `var(--colour-${name})`;
    });
  } else {
    // 1. Tailwind arbitrary values inside class strings.
    src = src.replace(
      /\b(bg|text|border|from|via|to|fill|stroke|ring|outline|decoration|shadow|caret|accent|divide|placeholder)-\[(#[0-9A-Fa-f]{6})\]/g,
      (whole, util, hex) => {
        const name = BY_HEX[hex.toLowerCase()];
        if (!name) return whole;
        // The Tailwind key differs from the token name for the two scales that
        // are nested objects: `page-body` is `page.body`, written `page-body`
        // as a class either way, so the token name IS the class suffix.
        edits.push({ rel, from: whole, to: `${util}-${name}` });
        return `${util}-${name}`;
      },
    );

    // 2. String literals: '#F1F43B' / "#f1f43b" / `#F1F43B`
    //
    // A JSX attribute needs braces around an expression — `fill='#F1F43B'`
    // becomes `fill={colour.acid}`, not `fill=colour.acid`, which is a parse
    // error. The lookbehind spots the attribute position.
    src = src.replace(/(^|[^=])(['"`])(#[0-9A-Fa-f]{6})\2/g, (whole, lead, q, hex) => {
      const name = BY_HEX[hex.toLowerCase()];
      if (!name) return whole;
      usedJsToken = true;
      edits.push({ rel, from: q + hex + q, to: jsRef(name) });
      return lead + jsRef(name);
    });
    src = src.replace(/(\b[A-Za-z_$][\w$]*=)(['"`])(#[0-9A-Fa-f]{6})\2/g, (whole, attr, q, hex) => {
      const name = BY_HEX[hex.toLowerCase()];
      if (!name) return whole;
      usedJsToken = true;
      edits.push({ rel, from: whole, to: `${attr}{${jsRef(name)}}` });
      return `${attr}{${jsRef(name)}}`;
    });

    if (usedJsToken && !/from ['"][^'"]*styles\/tokens['"]/.test(src)) {
      const depth = rel.split('/').length - 2; // relative to src/
      const spec = depth === 0 ? './styles/tokens' : `${'../'.repeat(depth)}styles/tokens`;
      // After the last top-of-file import so the group stays together.
      const imports = [...src.matchAll(/^import .*?;$/gm)];
      const line = `import { colour } from '${spec}';`;
      if (imports.length) {
        const last = imports[imports.length - 1];
        src = src.slice(0, last.index + last[0].length) + '\n' + line + src.slice(last.index + last[0].length);
      } else {
        src = line + '\n' + src;
      }
      edits.push({ rel, from: '(no import)', to: line });
    }
  }

  if (src !== before && !DRY) fs.writeFileSync(file, src);
}

const byFile = {};
for (const e of edits) (byFile[e.rel] ||= []).push(e);
for (const [rel, list] of Object.entries(byFile)) {
  console.log(`\n${rel}  (${list.length})`);
  const seen = new Set();
  for (const e of list) {
    const k = e.from + '→' + e.to;
    if (seen.has(k)) continue;
    seen.add(k);
    const n = list.filter(x => x.from === e.from && x.to === e.to).length;
    console.log(`   ${e.from.padEnd(34)} → ${e.to}${n > 1 ? `   ×${n}` : ''}`);
  }
}
console.log(`\n${edits.length} replacement(s) across ${Object.keys(byFile).length} file(s)`
  + `${DRY ? ' — DRY RUN, nothing written' : ''}\n`);
