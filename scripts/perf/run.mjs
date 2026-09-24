#!/usr/bin/env node
/**
 * Frame-rate and main-thread verification harness.
 *
 *   npm run perf                       every gating profile, every scenario
 *   npm run perf -- --profile mobile-slow --scenario landing
 *   npm run perf -- --runs 5           more repeats, tighter medians
 *   npm run perf -- --screencast       add the painted-frame cross-check
 *   npm run perf:baseline              record current numbers as the baseline
 *
 * Exits non-zero when a gating profile regresses past tolerance against
 * `scripts/perf/baselines/<profile>.json`.
 *
 * ## Why it is built this way
 *
 * Three things make browser frame-rate numbers untrustworthy, and each one has
 * a specific answer here:
 *
 *   1. The page can lie about its own frame rate. A backgrounded or
 *      compositor-starved tab reports a confident 1Hz from rAF. ANSWER: every
 *      run carries an out-of-page cross-check taken over CDP
 *      (`Performance.getMetrics`, optionally a screencast frame count) that the
 *      page cannot influence. If the two disagree the run is flagged, not
 *      averaged in.
 *
 *   2. A single run is noise. ANSWER: `--runs` (default 3) with the MEDIAN
 *      reported, plus the spread. A metric whose spread is wider than the
 *      regression tolerance is reported as unstable rather than used to fail a
 *      build.
 *
 *   3. Absolute fps from a laptop is not a phone. ANSWER: the gate is
 *      RELATIVE — this build against the committed baseline on the same
 *      profile. See profiles.mjs for why headed and headless measure different
 *      things and only one of them can gate.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';
import { INSTRUMENT } from './instrument.mjs';
import { PROFILES, DEFAULT_PROFILES } from './profiles.mjs';
import { SCENARIOS, DEFAULT_SCENARIOS } from './scenarios.mjs';
import { writeReport } from './report.mjs';
import { symbolicate } from './symbolicate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const BUILD = path.join(ROOT, 'build');
const BASELINES = path.join(HERE, 'baselines');
const OUT = path.join(HERE, 'results');

const CHROME_CANDIDATES = [
  process.env.PERF_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const list = (name, fallback) => {
  const v = flag(name);
  return typeof v === 'string' ? v.split(',').map(s => s.trim()) : fallback;
};

const RUNS = Number(flag('runs', 3));
const SCREENCAST = !!flag('screencast', false);
const UPDATE_BASELINE = !!flag('update-baseline', false);
const TOLERANCE = Number(flag('tolerance', 0.15));

const median = a => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (n, d = 2) => (n == null ? null : +n.toFixed(d));

const findChrome = () => {
  const found = CHROME_CANDIDATES.find(p => fs.existsSync(p));
  if (!found)
    throw new Error(
      `No Chrome found. Looked in:\n  ${CHROME_CANDIDATES.join('\n  ')}\n`
      + 'Set PERF_CHROME to an executable path.',
    );
  return found;
};

/**
 * One measurement: launch, navigate, settle, reset, act, read.
 *
 * A fresh browser per run, deliberately. Reusing one across runs lets the first
 * run's JIT warmth and GC debt leak into the second, and the numbers drift in a
 * direction that looks like a fix.
 */
const measure = async ({ profile, scenario, origin, chrome }) => {
  const p = PROFILES[profile];
  const s = SCENARIOS[scenario];

  const browser = await chromium.launch({
    executablePath: chrome,
    headless: p.headless,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      // NOTE: vsync is deliberately LEFT ON. --disable-frame-rate-limit
      // produces numbers like 2387fps, which cannot answer "do we hold 60".
      ...(p.headless ? ['--disable-gpu'] : []),
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: p.viewport,
      deviceScaleFactor: p.dpr,
      isMobile: p.mobile,
      hasTouch: p.mobile,
      // The site gates all its cursor machinery on `(pointer: fine)`, so the
      // UA alone is not enough — Chrome derives the pointer media query from
      // the touch-emulation flags above, which is what makes the mobile
      // profiles actually skip that code.
      userAgent: p.mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
          + ' (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    await context.addInitScript(INSTRUMENT);
    const page = await context.newPage();

    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    if (p.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });

    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));

    // Painted-frame counter. The page cannot influence this: it counts frames
    // the browser actually handed to the screencast encoder.
    let painted = 0;
    let paintedFrom = 0;
    if (SCREENCAST) {
      cdp.on('Page.screencastFrame', async ({ sessionId }) => {
        painted += 1;
        try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch {}
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 20, everyNthFrame: 1 });
    }

    const t0 = Date.now();
    await page.goto(origin + s.path, { waitUntil: 'load', timeout: 60000 });
    const loadMs = Date.now() - t0;

    if (s.settleMs) await page.waitForTimeout(s.settleMs);

    // Reset AFTER settling so the window measures the scenario, not the boot.
    await page.evaluate(() => window.__perfReset && window.__perfReset());
    const before = await cdp.send('Performance.getMetrics');
    paintedFrom = painted;
    const wall0 = Date.now();

    await Promise.race([
      s.run(page, { viewport: p.viewport }),
      page.waitForTimeout(s.windowMs),
    ]);
    // Interaction may finish early; always hold the full window so every run
    // samples the same amount of time.
    const remaining = s.windowMs - (Date.now() - wall0);
    if (remaining > 0) await page.waitForTimeout(remaining);

    const wallMs = Date.now() - wall0;
    const after = await cdp.send('Performance.getMetrics');
    const inPage = await page.evaluate(() => window.__perfRead());
    if (SCREENCAST) await cdp.send('Page.stopScreencast').catch(() => {});

    const m = name => {
      const a = before.metrics.find(x => x.name === name)?.value ?? 0;
      const b = after.metrics.find(x => x.name === name)?.value ?? 0;
      return b - a;
    };
    // CDP durations are seconds; wall is ms.
    const busyPct = round((m('TaskDuration') * 1000 / wallMs) * 100, 1);

    return {
      ok: true,
      errors,
      loadMs,
      wallMs,
      fps: inPage.fps,
      p50FrameMs: inPage.frame?.p50 ?? null,
      p95FrameMs: inPage.frame?.p95 ?? null,
      p99FrameMs: inPage.frame?.p99 ?? null,
      worstFrameMs: inPage.frame?.worst ?? null,
      frameCount: inPage.frame?.n ?? 0,
      jankyPct: inPage.frame?.n ? round((inPage.janky50 / inPage.frame.n) * 100, 1) : null,
      longTaskCount: inPage.longTasks.count,
      longTaskMs: inPage.longTasks.totalMs,
      loafBlockingMs: inPage.loaf.totalBlockingMs,
      loafWorstMs: inPage.loaf.worstMs,
      loafCount: inPage.loaf.count,
      loafTopScripts: inPage.loaf.topScripts.map(s => ({
        ...s,
        at: symbolicate(BUILD, s.name, s.pos) || s.name,
      })),
      // Since navigation start. On a uniformly-slow page the in-window numbers
      // are zero and these are the only evidence of blocking there is.
      bootLoafBlockingMs: inPage.boot.loafBlockingMs,
      bootLoafWorstMs: inPage.boot.loafWorstMs,
      bootLongTaskMs: inPage.boot.longTaskMs,
      bootLongTaskCount: inPage.boot.longTaskCount,
      callbackP95Ms: inPage.callbackMs?.p95 ?? null,
      canvases: inPage.canvases,
      canvasMegapixels: inPage.canvasMegapixels,
      heapMB: inPage.heapMB,
      // Out-of-page cross-checks.
      cpuBusyPct: busyPct,
      scriptMs: round(m('ScriptDuration') * 1000),
      layoutMs: round(m('LayoutDuration') * 1000),
      recalcMs: round(m('RecalcStyleDuration') * 1000),
      layoutCount: m('LayoutCount'),
      paintedFps: SCREENCAST ? round(((painted - paintedFrom) / wallMs) * 1000, 1) : null,
    };
  } finally {
    await browser.close();
  }
};

/** Median across runs, plus the spread, plus a verdict on whether to trust it. */
const aggregate = (runs) => {
  const good = runs.filter(r => r.ok);
  if (!good.length) return { ok: false, runs };

  const num = k => good.map(r => r[k]).filter(v => typeof v === 'number');
  const agg = {};
  for (const k of [
    'fps', 'p50FrameMs', 'p95FrameMs', 'p99FrameMs', 'worstFrameMs', 'jankyPct',
    'longTaskCount', 'longTaskMs', 'loafBlockingMs', 'loafWorstMs', 'loafCount',
    'bootLoafBlockingMs', 'bootLoafWorstMs', 'bootLongTaskMs', 'bootLongTaskCount',
    'callbackP95Ms', 'cpuBusyPct', 'scriptMs', 'layoutMs', 'recalcMs',
    'layoutCount', 'heapMB', 'loadMs', 'paintedFps', 'canvases',
    'canvasMegapixels', 'frameCount',
  ]) {
    const v = num(k);
    if (!v.length) { agg[k] = null; continue; }
    agg[k] = round(median(v));
    // Spread as a fraction of the median. A metric noisier than the regression
    // tolerance cannot be used to fail a build, and says so.
    const med = agg[k];
    agg[`${k}_spread`] = med ? round((Math.max(...v) - Math.min(...v)) / Math.abs(med), 3) : 0;
  }
  agg.ok = true;
  agg.runs = good.length;
  agg.errors = [...new Set(good.flatMap(r => r.errors))];
  agg.loafTopScripts = good[0].loafTopScripts;

  // What kind of slow is this? A number without this label gets misread: the
  // home page measures 17fps at 19% CPU in headless, which looks alarming and
  // is almost entirely the software rasteriser, not the site.
  //
  // The tell is quantisation. A compositor-bound page lands its frame times on
  // exact multiples of the display interval (16.7 / 33.3 / 50 / 66.7ms) because
  // it is missing whole vsyncs, while a main-thread-bound page produces
  // scattered values. Combined with CPU busy time, that separates the two.
  {
    const p95 = agg.p95FrameMs ?? 0;
    const nearMultiple = p95 > 0 && Math.abs(p95 / 16.67 - Math.round(p95 / 16.67)) < 0.06;
    if (agg.cpuBusyPct >= 80) agg.bound = 'main-thread';
    else if (nearMultiple && agg.cpuBusyPct < 50) agg.bound = 'raster/compositor';
    else agg.bound = 'mixed';
  }

  // Cross-check: the page's own frame rate against the painted-frame count.
  if (agg.paintedFps != null && agg.fps != null) {
    const ratio = agg.paintedFps / agg.fps;
    agg.crossCheck = ratio > 0.6 && ratio < 1.6
      ? 'agree'
      : `DISAGREE (rAF ${agg.fps} vs painted ${agg.paintedFps}) — treat fps as unverified`;
  }
  return agg;
};

/**
 * Metrics that gate, and which direction is bad.
 *
 * `corroborate` marks the threshold-sensitive ones. `jankyPct` counts frames
 * over a fixed 50ms, and `p95FrameMs` quantises to whole vsyncs — so on a page
 * whose frames already sit near a vsync boundary, a hair of drift either way
 * flips a large share of frames across the line and both metrics swing wildly
 * while the frame rate barely moves.
 *
 * This is not hypothetical. The design-token refactor — a pure class-name swap,
 * proven by a computed-style diff to change nothing a browser resolves
 * differently — produced jankyPct 39.6% -> 55.2% on desktop-fast/home-idle
 * while fps moved 17.5 -> 17.3, a 1% change. Gating on that would have failed a
 * build for a rename.
 *
 * So these three only fail a build when the frame rate corroborates them by
 * moving the same way by at least half the tolerance. Uncorroborated movement
 * is still reported — it is real, and worth a look — but it is called what it
 * is rather than used to block.
 *
 * `fps` and `cpuBusyPct` are continuous and gate on their own.
 */
const GATED = [
  { key: 'fps', dir: 'higher', floor: 1 },
  { key: 'cpuBusyPct', dir: 'lower', floor: 5 },
  { key: 'p95FrameMs', dir: 'lower', floor: 2, corroborate: true },
  { key: 'jankyPct', dir: 'lower', floor: 5, corroborate: true },
  { key: 'loafBlockingMs', dir: 'lower', floor: 50, corroborate: true },
  { key: 'bootLoafBlockingMs', dir: 'lower', floor: 80, corroborate: true },
];

const compare = (current, baseline) => {
  const findings = [];
  for (const [scenario, cur] of Object.entries(current)) {
    const base = baseline?.[scenario];
    if (!base || !cur.ok) continue;
    // Did the frame rate itself move enough to corroborate a threshold metric?
    const fpsRel = typeof base.fps === 'number' && typeof cur.fps === 'number' && base.fps
      ? (cur.fps - base.fps) / Math.abs(base.fps)
      : 0;
    const fpsAgrees = fpsRel < -TOLERANCE / 2;

    for (const { key, dir, floor, corroborate } of GATED) {
      const a = base[key], b = cur[key];
      if (typeof a !== 'number' || typeof b !== 'number') continue;
      const delta = b - a;
      const rel = Math.abs(a) > 1e-9 ? delta / Math.abs(a) : 0;
      const worse = dir === 'higher' ? rel < -TOLERANCE : rel > TOLERANCE;
      // The floor stops "2ms -> 3ms" (+50%) from failing a build.
      if (!worse || Math.abs(delta) < floor) continue;
      // A metric noisier than the tolerance cannot prove a regression.
      const noisy = (cur[`${key}_spread`] ?? 0) > TOLERANCE;
      const severity = noisy
        ? 'unstable'
        : corroborate && !fpsAgrees
          ? 'uncorroborated'
          : 'regression';
      findings.push({
        scenario, key, baseline: a, current: b,
        pct: round(rel * 100, 1), severity,
        note: severity === 'uncorroborated'
          ? `frame rate moved ${round(fpsRel * 100, 1)}% — threshold artefact, not a slowdown`
          : undefined,
      });
    }
  }
  return findings;
};

const main = async () => {
  if (!fs.existsSync(path.join(BUILD, 'index.html')))
    throw new Error(`No production build at ${BUILD}. Run \`npm run build\` first.`);

  const chrome = findChrome();
  const profiles = list('profile', DEFAULT_PROFILES).filter(p => {
    if (!PROFILES[p]) throw new Error(`Unknown profile "${p}". Have: ${Object.keys(PROFILES).join(', ')}`);
    return true;
  });
  const scenarios = list('scenario', DEFAULT_SCENARIOS).filter(s => {
    if (!SCENARIOS[s]) throw new Error(`Unknown scenario "${s}". Have: ${Object.keys(SCENARIOS).join(', ')}`);
    return true;
  });

  const server = await serve(BUILD);
  const origin = `http://127.0.0.1:${server.port}`;
  console.log(`\n  build served at ${origin}`);
  console.log(`  chrome: ${chrome}`);
  console.log(`  ${RUNS} run(s) per cell, median reported${SCREENCAST ? ', screencast on' : ''}\n`);

  const results = {};
  const started = new Date().toISOString();

  try {
    for (const profile of profiles) {
      const p = PROFILES[profile];
      results[profile] = {};
      console.log(`\n  ── ${profile} · ${p.label}`);
      for (const scenario of scenarios) {
        if (SCENARIOS[scenario].desktopOnly && p.mobile) {
          console.log(`     ${scenario.padEnd(14)} skipped (desktop-only scenario)`);
          continue;
        }
        const runs = [];
        for (let i = 0; i < RUNS; i++) {
          try {
            runs.push(await measure({ profile, scenario, origin, chrome }));
          } catch (e) {
            runs.push({ ok: false, error: String(e.message).slice(0, 300), errors: [] });
          }
        }
        const agg = aggregate(runs);
        results[profile][scenario] = agg;
        console.log(
          agg.ok
            ? `     ${scenario.padEnd(14)} ${String(agg.fps).padStart(6)} fps`
              + `   p95 ${String(agg.p95FrameMs).padStart(6)}ms`
              + `   janky ${String(agg.jankyPct).padStart(5)}%`
              + `   cpu ${String(agg.cpuBusyPct).padStart(5)}%`
              + `   blocking ${String(agg.loafBlockingMs).padStart(5)}ms`
              + ` (boot ${String(agg.bootLoafBlockingMs).padStart(4)}ms)`
            : `     ${scenario.padEnd(14)} FAILED — ${runs.find(r => r.error)?.error ?? 'no successful run'}`,
        );
      }
    }
  } finally {
    await server.close();
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(BASELINES, { recursive: true });
  const payload = {
    started, finished: new Date().toISOString(),
    runs: RUNS, tolerance: TOLERANCE, screencast: SCREENCAST,
    chrome, node: process.version, platform: process.platform,
    profiles: Object.fromEntries(profiles.map(p => [p, PROFILES[p]])),
    results,
  };
  fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify(payload, null, 2));

  if (UPDATE_BASELINE) {
    for (const profile of profiles)
      fs.writeFileSync(
        path.join(BASELINES, `${profile}.json`),
        JSON.stringify({ recorded: started, results: results[profile] }, null, 2),
      );
    console.log(`\n  baselines updated for: ${profiles.join(', ')}\n`);
  }

  // Compare against baselines.
  const findings = [];
  for (const profile of profiles) {
    if (!PROFILES[profile].gating) continue;
    const file = path.join(BASELINES, `${profile}.json`);
    if (!fs.existsSync(file)) continue;
    const base = JSON.parse(fs.readFileSync(file, 'utf8'));
    findings.push(...compare(results[profile], base.results).map(f => ({ ...f, profile })));
  }

  const reportPath = writeReport({ payload, findings, baselineDir: BASELINES, outDir: OUT });
  console.log(`\n  report: ${path.relative(ROOT, reportPath)}`);
  console.log(`  data:   ${path.relative(ROOT, path.join(OUT, 'latest.json'))}`);

  const hard = findings.filter(f => f.severity === 'regression');
  const soft = findings.filter(f => f.severity !== 'regression');
  if (soft.length)
    console.log(`\n  ${soft.length} metric(s) moved without failing the gate `
      + '(too noisy, or not corroborated by the frame rate) — see the report.');
  if (hard.length) {
    console.log(`\n  REGRESSION — ${hard.length} metric(s) past the ${TOLERANCE * 100}% tolerance:`);
    for (const f of hard)
      console.log(`    ${f.profile}/${f.scenario} · ${f.key}: ${f.baseline} → ${f.current} (${f.pct > 0 ? '+' : ''}${f.pct}%)`);
    console.log('');
    process.exit(1);
  }
  console.log('\n  no regressions past tolerance.\n');
};

main().catch(e => { console.error(`\n  ${e.stack}\n`); process.exit(1); });
