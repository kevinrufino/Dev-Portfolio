#!/usr/bin/env node
/**
 * Computed-style snapshots — the safety net for the design-token refactor.
 *
 *   node scripts/perf/style-snapshot.mjs --out before
 *   ...make the change, npm run build...
 *   node scripts/perf/style-snapshot.mjs --out after --compare before
 *
 * ## Why computed styles and not screenshots
 *
 * Swapping `text-[#dcddd7]` for `text-page-body` is supposed to change nothing
 * a visitor can see. A screenshot diff would prove that too, but it proves it
 * loosely — antialiasing, video frames and physics all move between runs, so
 * the comparison needs a tolerance, and a tolerance is exactly where a real
 * one-shade drift hides.
 *
 * Resolved styles have no tolerance. `rgb(220, 221, 215)` either matches or it
 * does not, and when it does not the diff names the element and both values.
 * That turns "looks the same to me" into a checkable claim.
 *
 * Animated properties (transform, opacity) are excluded on purpose: they differ
 * between two runs of identical code and would bury the signal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from './server.mjs';
import { PROFILES } from './profiles.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const BUILD = path.join(ROOT, 'build');
const SNAPS = path.join(HERE, 'snapshots');

/** Routes worth guarding. Every page that renders tokenised colour. */
const ROUTES = [
  '/',
  '/projects/swoosh-404',
  '/projects/candid-chat-agent',
  '/projects/max-s-lab',
  '/projects/tinaj-collection-listing-page',
  '/projects/ea-sports-fc-partner-page',
  '/projects/our-force-1-poster-content-display-page',
  '/projects/moodie',
  '/studio',
];

/** The properties a token refactor can plausibly break. */
const PROPS = [
  'color', 'background-color', 'background-image',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-radius', 'box-shadow', 'outline-color', 'fill', 'stroke',
  'font-family', 'font-size', 'font-weight', 'letter-spacing', 'line-height',
  'text-transform', 'text-decoration-color',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'gap', 'row-gap', 'column-gap',
  'width', 'height',
];

const COLLECT = (props) => `(() => {
  const props = ${JSON.stringify(props)};
  const out = {};
  // A stable key per element: the tag path from <body> plus the sibling index
  // at each step. Class names are deliberately NOT part of the key — the whole
  // point of the refactor is that class names change while everything else
  // stays put, and a key built from them would report every element as new.
  const keyOf = (el) => {
    const parts = [];
    let n = el;
    while (n && n !== document.body) {
      const p = n.parentElement;
      if (!p) break;
      const i = [...p.children].indexOf(n);
      parts.unshift(n.tagName.toLowerCase() + '[' + i + ']');
      n = p;
    }
    return parts.join('>');
  };
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const rec = {};
    for (const p of props) rec[p] = cs.getPropertyValue(p);
    // Keep the class list alongside as context for reading a diff — it is
    // recorded, never compared.
    rec['@class'] = el.getAttribute('class') || '';
    out[keyOf(el)] = rec;
  }
  return out;
})()`;

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); if (i === -1) return d;
  const v = argv[i + 1]; return v && !v.startsWith('--') ? v : true; };

const capture = async (label) => {
  if (!fs.existsSync(path.join(BUILD, 'index.html')))
    throw new Error(`No production build at ${BUILD}. Run \`npm run build\` first.`);

  const chrome = process.env.PERF_CHROME
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const server = await serve(BUILD);
  const origin = `http://127.0.0.1:${server.port}`;
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--disable-gpu'] });
  const snapshot = { label, captured: new Date().toISOString(), viewports: {} };

  try {
    for (const [vpName, vp] of [
      ['desktop', PROFILES['desktop-fast']],
      ['mobile', PROFILES['mobile-mid']],
    ]) {
      const context = await browser.newContext({
        viewport: vp.viewport, deviceScaleFactor: vp.dpr,
        isMobile: vp.mobile, hasTouch: vp.mobile,
        // Animations settle to their end state, so two captures of identical
        // code agree instead of catching different frames of the same reveal.
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      snapshot.viewports[vpName] = {};
      for (const route of ROUTES) {
        await page.goto(origin + route, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(6000);
        snapshot.viewports[vpName][route] = await page.evaluate(COLLECT(PROPS));
        const count = Object.keys(snapshot.viewports[vpName][route]).length;
        console.log(`  ${vpName.padEnd(8)} ${route.padEnd(48)} ${String(count).padStart(5)} elements`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return snapshot;
};

const diff = (before, after) => {
  const changes = [];
  for (const vp of Object.keys(after.viewports)) {
    for (const route of Object.keys(after.viewports[vp])) {
      const A = before.viewports?.[vp]?.[route];
      const B = after.viewports[vp][route];
      if (!A) { changes.push({ vp, route, kind: 'new-route' }); continue; }
      const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
      for (const k of keys) {
        if (!A[k]) { changes.push({ vp, route, el: k, kind: 'added', cls: B[k]['@class'] }); continue; }
        if (!B[k]) { changes.push({ vp, route, el: k, kind: 'removed', cls: A[k]['@class'] }); continue; }
        for (const p of PROPS) {
          if (A[k][p] === B[k][p]) continue;
          changes.push({
            vp, route, el: k, kind: 'changed', prop: p,
            before: A[k][p], after: B[k][p],
            clsBefore: A[k]['@class'], clsAfter: B[k]['@class'],
          });
        }
      }
    }
  }
  return changes;
};

const main = async () => {
  fs.mkdirSync(SNAPS, { recursive: true });
  const out = String(flag('out', 'current'));
  const against = flag('compare', null);

  console.log(`\n  capturing computed styles → ${out}\n`);
  const snap = await capture(out);
  const file = path.join(SNAPS, `${out}.json`);
  fs.writeFileSync(file, JSON.stringify(snap));
  console.log(`\n  wrote ${path.relative(ROOT, file)} `
    + `(${(fs.statSync(file).size / 1048576).toFixed(1)}MB)\n`);

  if (!against) return;
  const baseFile = path.join(SNAPS, `${against}.json`);
  if (!fs.existsSync(baseFile)) throw new Error(`No snapshot "${against}" at ${baseFile}`);
  const changes = diff(JSON.parse(fs.readFileSync(baseFile, 'utf8')), snap);

  const report = path.join(SNAPS, `diff-${against}-vs-${out}.md`);
  const L = [`# Computed-style diff — \`${against}\` → \`${out}\``, ''];
  if (!changes.length) {
    L.push('**No differences.** Every element on every route resolves to exactly the');
    L.push('same colour, spacing, border, shadow and type as before the change.', '');
    console.log('  ✅ IDENTICAL — no computed style changed on any route.\n');
  } else {
    const byProp = {};
    for (const c of changes) byProp[c.prop || c.kind] = (byProp[c.prop || c.kind] || 0) + 1;
    L.push(`**${changes.length} difference(s).**`, '', '| what | count |', '|---|---|');
    for (const [k, v] of Object.entries(byProp).sort((a, b) => b[1] - a[1])) L.push(`| \`${k}\` | ${v} |`);
    L.push('', '## Every difference', '', '| viewport | route | element | property | before | after |');
    L.push('|---|---|---|---|---|---|');
    for (const c of changes.slice(0, 400))
      L.push(`| ${c.vp} | \`${c.route}\` | \`${(c.el || '').slice(-70)}\` | \`${c.prop || c.kind}\` `
        + `| \`${c.before ?? ''}\` | \`${c.after ?? ''}\` |`);
    if (changes.length > 400) L.push(`| … | ${changes.length - 400} more, see the JSON | | | | |`);
    L.push('');
    fs.writeFileSync(path.join(SNAPS, `diff-${against}-vs-${out}.json`), JSON.stringify(changes, null, 2));
    console.log(`  ⚠️  ${changes.length} computed style difference(s):`);
    for (const [k, v] of Object.entries(byProp).sort((a, b) => b[1] - a[1]).slice(0, 8))
      console.log(`       ${String(v).padStart(5)} × ${k}`);
    console.log('');
  }
  fs.writeFileSync(report, L.join('\n'));
  console.log(`  diff: ${path.relative(ROOT, report)}\n`);
  if (changes.length) process.exit(1);
};

main().catch(e => { console.error(`\n  ${e.stack}\n`); process.exit(1); });
