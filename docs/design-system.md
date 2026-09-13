# Design system

Figma is the source of truth. The chain is one-directional:

```
Figma file (HVAOVM33y8u9vZxiwR8jEp)
  └─ export ──> src/styles/tokens.json        the record
       └─ node scripts/sync-figma-tokens.mjs
            ├─> src/styles/tokens.css         87 custom properties, for stylesheets
            └─  src/styles/tokens.js          the same values, for JavaScript
                 tailwind.config.js reads tokens.json directly for utilities
```

Change a value in Figma, re-export, re-run the sync. Nothing else in the
repository is allowed to carry a colour value of its own.

## Using a token

| where | how |
|---|---|
| a class | `text-page-body`, `bg-page`, `border-page-rule`, `text-body-l` |
| a stylesheet | `color: var(--colour-page-body)` |
| JavaScript (canvas, inline style, physics) | `import { colour } from '../styles/tokens'` → `colour['page-body']` |

The JS module is what closed the last gap. Canvas code cannot read a CSS custom
property, so every `fillStyle` on the site used to be a hex literal that no
design change could ever reach.

## Scales

**Ground colours** — `acid`, `ultra`, `paper`, `charcoal`, `page`, `palm-gold`.

**Ink ramps**, one per ground. `paper-ink` / `paper-muted` / `paper-rule`;
`charcoal-*`; `page-ink` / `page-ink-bright` / `page-body` / `page-meta` /
`page-muted` / `page-caption` / `page-faint` / `page-rule` / `page-rule-strong`.

**On-ground ramps** for text sitting on a saturated field — `on-acid-*`,
`on-ultra-*`, `on-charcoal-link`. The works pane inverts between the ultra and
acid grounds, and each needs its own ramp because one palette's ink is the
other's ground.

**Type** — a fluid ramp, `display-hero` down to `label`. Each token carries its
size, line-height and tracking together, so `text-body-l` sets all three and the
call site stops restating them.

**Space, motion, effects** — the 6px lattice and its multiples, three durations
and the CTA easing, the three hard shadows.

## What is deliberately not tokenised

Three exclusions, enforced by `scripts/design-system/tokenise.mjs`. They are the
difference between a design system and a find-and-replace:

- **`src/components/Palm/palmEngine.js`** — fifteen colours that are a sprite
  ramp. Artwork, not interface. Naming them `colour.*` would imply they can be
  retuned from Figma without looking at the palm, which is not true.
- **`src/pages/studio.css`, `src/components/Project/edit/edit.css`** — the
  content editor's own chrome, on a separate dark palette. Unlinked internal
  tooling; putting twenty colours no visitor sees into the design file would
  make it harder to read, not easier.
- **`src/components/CursorFxDebug.js`** — a debug overlay behind `?edit`. Its
  magenta is meant to look like it does not belong.

## Known drift, not yet resolved

Naming a colour does not decide whether two near-identical colours should be
one. This pass deliberately changed **no pixel** — every token was added at the
exact value already on screen — so these remain open, and each needs a look at
the page rather than a rule:

**Colour.** `page-ink` `#E2E3DD` and `page-ink-bright` `#E8E9E3` differ by six
units across three channels. `ink-hard` `#1E1E1E` and `charcoal` `#202020` by
two. Almost certainly each pair was meant to be one value.

**Type.** `node scripts/design-system/audit-type.mjs` lists 30 hard-coded sizes
with no matching token. Most are near-duplicates of one that exists — the site
currently draws three different large display sizes:

| where | size | fluid |
|---|---|---|
| `display-l` token | 44 → 88px | 5.4vw |
| `Intro.js:99` | 44 → 88px | 5.2vw |
| `Footer.js:102` | 44 → 82px | 5.4vw |

and two label sizes (`11px/.3em` as the `label` token, `11px/.24em` and
`10px/.26em` and `10px/.28em` written by hand) where there is probably one.

Collapsing them is a design decision with a visible result. Make it in Figma,
re-export, and `style-snapshot.mjs` will report exactly which elements moved.

## Verifying a change that should be invisible

```bash
npm run build && node scripts/perf/style-snapshot.mjs --out before
# ...change...
npm run build && node scripts/perf/style-snapshot.mjs --out after --compare before
```

Walks every element on every route at two viewports and compares 35 resolved
properties with no tolerance. `rgb(226, 227, 221)` either matches or it does
not. This is how the colour pass in this commit was shown to be inert.

## Tools

| script | what it does |
|---|---|
| `scripts/sync-figma-tokens.mjs` | tokens.json → tokens.css |
| `scripts/design-system/tokenise.mjs` | replaces hex literals with tokens; `--dry` to preview |
| `scripts/design-system/audit-type.mjs` | reports type sizes against the scale; writes nothing |
| `scripts/perf/style-snapshot.mjs` | proves a refactor changed nothing visible |
