# Frame-rate verification

```bash
npm run build            # the harness measures the production build, never the dev server
npm run perf             # every gating profile × every scenario, 3 runs, median
npm run perf:quick       # one profile, one run — for a fast check while editing
npm run perf:baseline    # record the current numbers as the thing to beat
```

Exits non-zero when a gating profile regresses past tolerance (default 15%)
against `baselines/<profile>.json`.

```bash
npm run perf -- --profile mobile-slow --scenario landing
npm run perf -- --runs 5 --tolerance 0.1
npm run perf -- --screencast        # verify reported fps against painted frames
npm run perf -- --profile reference-gpu   # real GPU, headed, never gates
```

## How to read the numbers

**The absolute fps is not a phone number.** Two things make that so, both
measured on this machine rather than assumed:

| | 4× CPU throttle |
|---|---|
| headed Chrome | 121 fps — *identical* at 1×, 4× and 6× |
| headless Chrome | 23 fps, 198/200 frames janky |

Identical output at 1×, 4× and 6× is not a fast page, it is an ignored
instruction: `Emulation.setCPUThrottlingRate` does nothing in the headed
instance here. Headless honours it, but runs software rasterisation with
`--disable-gpu`, so it is pessimistic in a different direction.

So:

- **headless + throttle** is pessimistic, and it is the only configuration that
  *responds to load*. Only it can catch a regression, so only it gates.
- **headed** (`reference-gpu`) is optimistic — real GPU, 120Hz panel. Useful as a
  ceiling and for anything GPU-bound. It never gates, because a pass from an
  instrument that ignores the throttle would mean nothing.

What transfers between machines is the **ratio**: this build against the
previous build, measured the same way. That is what the gate checks.

### `bound by`

Each cell is labelled with what limited it:

- **main-thread** — CPU busy ≥80%. JavaScript is the problem. Real.
- **raster/compositor** — frame times land on exact multiples of 16.7ms while
  the main thread sits under half busy. The page is waiting on the rasteriser.
  Headless has no GPU, so this is substantially an artefact — check
  `--profile reference-gpu` before treating it as a site problem.
- **mixed** — neither test fired.

### `blocking (window)` vs `blocking (since load)`

Long-animation-frame entries need a 50ms frame to exist at all. A page running
at 23fps with every frame at 43ms trips that threshold on *no* frame, and the
in-window number reads `0ms` — true, and badly misleading. The since-load column
covers navigation start onward, where bundle parse and mount live. Read both.

## Why it is built the way it is

Three things make browser frame numbers untrustworthy. Each has an answer here:

**The page can lie about its own frame rate.** A tab that is not being
composited reports a confident ~1Hz from `requestAnimationFrame` — this is what
produced an earlier, wrong conclusion that headless Chrome "cannot measure
frames". So every run carries cross-checks taken over CDP, which page JS cannot
influence: `Performance.getMetrics` always, and with `--screencast` a count of
frames the browser actually produced. When the two disagree by more than 60/160%
the run says so instead of quietly averaging.

**One run is noise.** `--runs` (default 3), median reported, spread recorded. A
metric whose spread is wider than the regression tolerance is reported as
`unstable` and cannot fail a build on its own.

**A minified stack names nothing.** LoAF attributes a blocking frame to
`main.<hash>.js` at a character offset. `symbolicate.mjs` maps that back through
the build's source map, so the report says `components/Works/workFluid.js:121`
and the next step is obvious.

## Files

| file | what it is |
|---|---|
| `run.mjs` | orchestrator: profiles × scenarios × runs, medians, gating, exit code |
| `instrument.mjs` | the four in-page instruments, injected before page scripts |
| `scenarios.mjs` | what gets measured, and why each one is worth defending |
| `profiles.mjs` | device tiers, and which ones are allowed to gate |
| `symbolicate.mjs` | minified offset → source line, via the build's source map |
| `server.mjs` | static server for `build/`, SPA fallback, caching off |
| `report.mjs` | the markdown report |
| `style-snapshot.mjs` | computed-style capture and diff (see below) |
| `baselines/` | committed numbers the gate compares against |
| `results/` | last run's JSON + markdown (gitignored) |

## Computed-style snapshots

A separate tool for refactors that are supposed to change nothing visible —
swapping a hex literal for a design token, say:

```bash
npm run build && node scripts/perf/style-snapshot.mjs --out before
# ...make the change...
npm run build && node scripts/perf/style-snapshot.mjs --out after --compare before
```

It walks every element on every route at two viewports and records the resolved
value of 35 properties — colour, background, borders, radii, shadows, type,
spacing, size. The diff has no tolerance: `rgb(220, 221, 215)` either matches or
it does not, and when it does not the report names the element, the property and
both values. Exits non-zero on any difference.

Screenshots would prove the same thing more loosely — antialiasing, video frames
and physics all move between runs, so a pixel comparison needs a tolerance, and a
tolerance is where a real one-shade drift hides.

## Requirements

Chrome or Chromium on disk. The harness looks in the usual macOS and Linux
locations; set `PERF_CHROME` to override. `playwright-core` drives it — the
launcher and the CDP client, not the bundled browsers.
