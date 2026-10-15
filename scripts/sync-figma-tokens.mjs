#!/usr/bin/env node
/**
 * Figma → code. The direction of truth, made mechanical.
 *
 *   node scripts/sync-figma-tokens.mjs
 *
 * `src/styles/tokens.json` is exported from the design-system file's variables
 * and text styles. This turns it into the CSS custom properties the stylesheet
 * consumes, so a colour is changed in exactly one place — in Figma — and every
 * consumer follows. tailwind.config.js reads the same JSON, so the two ways of
 * writing a colour in this codebase can no longer disagree.
 *
 * Before this, they did: acid was declared in tailwind.config.js AND as --acid
 * in index.css, and the case-study greys were declared nowhere at all — written
 * as loose hexes in twelve components.
 *
 * Re-exporting the JSON itself is an agent step today rather than an API call:
 * it needs the Figma MCP (or a personal access token against the Variables REST
 * endpoint, which is an Enterprise feature). The JSON is committed, so the build
 * never depends on Figma being reachable.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(
  readFileSync(path.join(root, 'src/styles/tokens.json'), 'utf8'),
);

const lines = [
  '/* GENERATED — do not edit.',
  ' *',
  ' * Written by scripts/sync-figma-tokens.mjs from src/styles/tokens.json,',
  ` * which is exported from ${tokens.$source.url}`,
  ' *',
  ' * Change a value in Figma, re-export, re-run the sync. Editing this file by',
  ' * hand puts the code and the design file back into the disagreement this',
  ' * whole arrangement exists to end.',
  ' */',
  '',
  ':root {',
];

const push = (prefix, obj, fmt = v => v) => {
  lines.push(`  /* ${prefix} */`);
  for (const [key, value] of Object.entries(obj)) {
    lines.push(`  --${prefix}-${key}: ${fmt(value)};`);
  }
  lines.push('');
};

push('colour', tokens.colour);
push('space', tokens.space, v => `${v}px`);
push('motion', tokens.motion, v => (typeof v === 'number' ? `${v}ms` : v));
push('shadow', tokens.effect);

lines.push('  /* type — fluid ramp, min → max across the viewport */');
for (const [name, t] of Object.entries(tokens.type)) {
  const size =
    t.min === t.max ? `${t.max}px` : `clamp(${t.min}px, ${t.fluid}, ${t.max}px)`;
  lines.push(`  --text-${name}: ${size};`);
  lines.push(`  --text-${name}-leading: ${t.lineHeight};`);
  lines.push(`  --text-${name}-tracking: ${t.tracking};`);
}
lines.push('}');
lines.push('');

const out = path.join(root, 'src/styles/tokens.css');
writeFileSync(out, lines.join('\n'));

const count =
  Object.keys(tokens.colour).length +
  Object.keys(tokens.space).length +
  Object.keys(tokens.motion).length +
  Object.keys(tokens.effect).length +
  Object.keys(tokens.type).length * 3;

console.log(`\n  Wrote src/styles/tokens.css — ${count} custom properties.`);
console.log(`  Source: ${tokens.$source.file} (${tokens.$source.fileKey})\n`);
