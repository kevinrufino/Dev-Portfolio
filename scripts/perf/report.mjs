/**
 * Turns a run into a markdown report a human can read in the PR.
 *
 * The JSON next to it is the machine-readable record; this exists so a
 * regression arrives as a sentence rather than a diff of numbers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SCENARIOS } from './scenarios.mjs';

const n = v => (v == null ? '—' : String(v));

export const writeReport = ({ payload, findings, baselineDir, outDir }) => {
  const { results, profiles, runs, tolerance, started, screencast } = payload;
  const L = [];

  L.push('# Frame-rate verification report', '');
  L.push(`Run ${started} · ${runs} run(s) per cell, median reported · tolerance ${tolerance * 100}%`);
  L.push(`Chrome \`${payload.chrome}\` · node ${payload.node} · ${payload.platform}`, '');

  L.push('> **Read these as ratios, not as phone numbers.** Headless Chrome has no');
  L.push('> GPU and headed Chrome ignores CPU throttling on this machine, so neither');
  L.push('> configuration is an iPhone. What transfers is this build against the');
  L.push('> previous build on the same profile. See `scripts/perf/profiles.mjs`.', '');

  if (findings.length) {
    const hard = findings.filter(f => f.severity === 'regression');
    const soft = findings.filter(f => f.severity !== 'regression');
    L.push(hard.length ? '## ❌ Regressions' : '## ⚠️ Movement');
    L.push('', '| profile | scenario | metric | baseline | now | change | |');
    L.push('|---|---|---|---|---|---|---|');
    for (const f of [...hard, ...soft])
      L.push(`| ${f.profile} | ${f.scenario} | \`${f.key}\` | ${f.baseline} | ${f.current} `
        + `| ${f.pct > 0 ? '+' : ''}${f.pct}% | ${
          f.severity === 'unstable' ? 'too noisy to call'
          : f.severity === 'uncorroborated' ? (f.note || 'not corroborated by the frame rate')
          : 'over tolerance'} |`);
    L.push('');
  } else {
    L.push('## ✅ No regressions past tolerance', '');
  }

  for (const [profile, scenarios] of Object.entries(results)) {
    const p = profiles[profile];
    L.push(`## ${profile} — ${p.label}`);
    L.push('');
    L.push(`${p.viewport.width}×${p.viewport.height} @${p.dpr}x · ${p.cpu}× CPU · `
      + `${p.headless ? 'headless' : 'headed'} · ${p.gating ? '**gates**' : 'reference only'}`);
    L.push('');
    L.push('| scenario | fps | p95 frame | worst | janky | cpu busy | bound by | blocking (window) | blocking (since load) | long tasks | canvas MP |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [name, r] of Object.entries(scenarios)) {
      if (!r.ok) { L.push(`| ${name} | failed | | | | | | | | | |`); continue; }
      L.push(`| ${name} | ${n(r.fps)} | ${n(r.p95FrameMs)}ms | ${n(r.worstFrameMs)}ms `
        + `| ${n(r.jankyPct)}% | ${n(r.cpuBusyPct)}% | ${n(r.bound)} | ${n(r.loafBlockingMs)}ms `
        + `| ${n(r.bootLoafBlockingMs)}ms | ${n(r.longTaskCount)} | ${n(r.canvasMegapixels)} |`);
    }
    L.push('');

    // Attribution — the part that turns a number into a next step.
    const attributed = Object.entries(scenarios)
      .filter(([, r]) => r.ok && r.loafTopScripts?.length);
    if (attributed.length) {
      L.push('<details><summary>What was blocking (LoAF attribution)</summary>', '');
      for (const [name, r] of attributed)
        L.push(`- **${name}** — ` + r.loafTopScripts
          .map(s => `\`${s.at}\` ${s.ms}ms${s.via ? ` (${s.via})` : ''}`).join(', '));
      L.push('', '</details>', '');
    }

    const flagged = Object.entries(scenarios).filter(([, r]) => r.ok && r.crossCheck && r.crossCheck !== 'agree');
    if (flagged.length) {
      L.push('**Cross-check disagreed** (the page\'s own frame count does not match painted frames):');
      for (const [name, r] of flagged) L.push(`- ${name}: ${r.crossCheck}`);
      L.push('');
    }

    const errored = Object.entries(scenarios).filter(([, r]) => r.ok && r.errors?.length);
    if (errored.length) {
      L.push('<details><summary>Page errors during the run</summary>', '');
      for (const [name, r] of errored) for (const e of r.errors) L.push(`- ${name}: \`${e}\``);
      L.push('', '</details>', '');
    }
  }

  L.push('## Scenarios', '');
  for (const [k, s] of Object.entries(SCENARIOS)) {
    L.push(`**\`${k}\`** — ${s.label}  `);
    L.push(`${s.why}  `);
    L.push(`_${s.path} · settle ${s.settleMs}ms · measure ${s.windowMs}ms_`, '');
  }

  if (!screencast)
    L.push('_Painted-frame cross-check not run. Add `--screencast` to verify the '
      + 'reported frame rate against frames the browser actually produced._', '');

  const raster = Object.entries(results).flatMap(([prof, sc]) =>
    Object.entries(sc).filter(([, r]) => r.ok && r.bound === 'raster/compositor').map(([name]) => `${prof}/${name}`));
  if (raster.length) {
    L.push('### On the `raster/compositor` rows', '');
    L.push('These frame times land on exact multiples of 16.7ms while the main thread');
    L.push('sits well under half busy — the page is waiting on the rasteriser, not on');
    L.push('JavaScript. Headless Chrome runs `--disable-gpu` software raster, so this');
    L.push('is largely an artefact of the instrument and a device with a real GPU will');
    L.push('do much better. Compare against `--profile reference-gpu` before treating');
    L.push('any of these as a site problem:', '');
    L.push(raster.map(r => `\`${r}\``).join(', '), '');
  }

  L.push('## Instruments', '');
  L.push('');
  L.push('**Blocking is reported twice on purpose.** `blocking (window)` counts only');
  L.push('the measurement window and is legitimately 0 on a page that is uniformly');
  L.push('slow rather than spiky — a 23fps page whose every frame takes 43ms trips no');
  L.push('50ms threshold. `blocking (since load)` covers navigation start onward,');
  L.push('where bundle parse and mount actually live.', '');
  L.push('| instrument | where | what it catches | how it lies |');
  L.push('|---|---|---|---|');
  L.push('| rAF deltas | in page | the frame rate the page experiences | reports a confident ~1Hz when the tab is not being composited |');
  L.push('| LoAF | in page | long animation frames **with script attribution** | Chrome 123+ only; silent on older builds |');
  L.push('| longtask observer | in page | main-thread blocks over 50ms | says nothing about whether a frame was dropped |');
  L.push('| rAF callback timing | in page | how long the page\'s own animation work takes | blind to work outside rAF |');
  L.push('| `Performance.getMetrics` | **over CDP** | task/script/layout/style time — page JS cannot touch it | aggregate only, no per-frame detail |');
  L.push('| screencast frame count | **over CDP** | frames the browser actually produced | the encoder itself costs something |');
  L.push('');

  const file = path.join(outDir, 'report.md');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(file, L.join('\n'));
  return file;
};
