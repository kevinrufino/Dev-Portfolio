#!/usr/bin/env node
/**
 * Check that src/styles/tokens.json still says what the Figma file says.
 *
 *   node scripts/design-system/reconcile-figma.mjs
 *
 * "Figma is the source of truth" is a claim, and a claim nothing checks decays
 * into a comment. This makes it checkable: it diffs the committed export in
 * `figma-export.json` against `tokens.json` and exits non-zero on any
 * disagreement, in either direction — a token in code that Figma does not have
 * is drift just as much as the reverse.
 *
 * ## Refreshing the export
 *
 * `figma-export.json` is a verbatim read-back. To refresh it, run this through
 * the Figma MCP against file HVAOVM33y8u9vZxiwR8jEp and paste the result in:
 *
 *   const cols = await figma.variables.getLocalVariableCollectionsAsync();
 *   const vars = await figma.variables.getLocalVariablesAsync();
 *   const hex = c => '#' + [c.r, c.g, c.b]
 *     .map(x => Math.round(x * 255).toString(16).padStart(2, '0').toUpperCase()).join('');
 *   const out = { colour: {}, space: {}, motion: {} };
 *   for (const v of vars) {
 *     const col = cols.find(c => c.id === v.variableCollectionId);
 *     const val = v.valuesByMode[col.modes[0].modeId];
 *     if (v.resolvedType === 'COLOR') out.colour[v.name] = hex(val);
 *     else if (col.name === 'Space') out.space[v.name] = val;
 *     else if (col.name === 'Motion') out.motion[v.name] = val;
 *   }
 *   return out;
 *
 * ## Naming
 *
 * Figma groups variables with slashes; tokens.json is flat, because it feeds
 * CSS custom property names and Tailwind keys. The mapping is mechanical:
 *
 *   brand/acid        -> acid          group dropped: brand is not a namespace
 *   neutral/white     -> white         same
 *   paper/surface     -> paper         a group's own ground takes the bare name
 *   page/ink-bright   -> page-ink-bright
 *   space/4           -> 4
 *   duration/cta      -> duration-cta
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const figma = JSON.parse(fs.readFileSync(path.join(HERE, 'figma-export.json'), 'utf8'));
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/styles/tokens.json'), 'utf8'));

const BARE_GROUPS = new Set(['brand', 'neutral', 'space']);
const flatten = (name) => {
  const [group, ...rest] = name.split('/');
  if (!rest.length) return name;
  const leaf = rest.join('-');
  if (BARE_GROUPS.has(group)) return leaf;
  if (leaf === 'surface') return group;
  return `${group}-${leaf}`;
};

const problems = [];
const check = (label, figmaGroup, codeGroup) => {
  const expected = {};
  for (const [k, v] of Object.entries(figmaGroup)) expected[flatten(k)] = v;
  const actual = Object.fromEntries(
    Object.entries(codeGroup).filter(([k]) => !k.startsWith('$')),
  );
  for (const k of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const a = expected[k];
    const b = typeof actual[k] === 'object' && actual[k] ? actual[k].value : actual[k];
    if (a === undefined) problems.push(`${label}: \`${k}\` is in tokens.json but not in Figma`);
    else if (b === undefined) problems.push(`${label}: \`${k}\` is in Figma but not in tokens.json`);
    else if (String(a).toUpperCase() !== String(b).toUpperCase())
      problems.push(`${label}: \`${k}\` — Figma ${a}, code ${b}`);
  }
};

check('colour', figma.colour, tokens.colour);
check('space', figma.space, tokens.space);
check('motion', figma.motion, tokens.motion);

if (problems.length) {
  console.error(`\n  ${problems.length} disagreement(s) between Figma and tokens.json:\n`);
  for (const p of problems) console.error(`    ${p}`);
  console.error('\n  Fix in Figma, re-export, re-run scripts/sync-figma-tokens.mjs.\n');
  process.exit(1);
}
const n = Object.keys(figma.colour).length + Object.keys(figma.space).length + Object.keys(figma.motion).length;
console.log(`\n  ✅ ${n} tokens agree — Figma (${figma.$fileKey}) and src/styles/tokens.json.\n`);
