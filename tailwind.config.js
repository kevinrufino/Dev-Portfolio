const tokens = require("./src/styles/tokens.json");
const c = tokens.colour;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // Every OffBit face names "OffBit Punctuation" behind it. The OffBit cut
    // in public/fonts is the trial: 68 glyphs, letters and figures and no
    // punctuation at all. Browsers fall back per glyph, so this is what draws
    // every apostrophe, comma and percent on the site. It is declared in
    // public/index.html — see the note there for what it is and why it lives
    // in the HTML rather than here.
    fontFamily: {
      offbit101: ["OffBit-101", "OffBit Punctuation", "sans-serif"],
      offbit101Bold: ["OffBit-101-Bold", "OffBit Punctuation", "sans-serif"],
      offbit: ["OffBit-Regular", "OffBit Punctuation", "sans-serif"],
      offbitBold: ["OffBit-Bold", "OffBit Punctuation", "sans-serif"],
      offbitDot: ["OffBit-Dot", "OffBit Punctuation", "monospace"],
      sans: ["DM Sans", "sans-serif"],
    },
    extend: {
      // Read from the generated token file rather than written out here. These
      // were declared twice — once in this object and once as custom properties
      // in index.css — which is exactly the kind of duplication that lets a
      // colour drift between the two and nobody notice.
      colors: {
        acid: c.acid,
        ultra: c.ultra,
        "palm-gold": c["palm-gold"],
        paper: {
          DEFAULT: c.paper,
          ink: c["paper-ink"],
          muted: c["paper-muted"],
          rule: c["paper-rule"],
        },
        charcoal: {
          DEFAULT: c.charcoal,
          ink: c["charcoal-ink"],
          muted: c["charcoal-muted"],
          rule: c["charcoal-rule"],
        },
        // The case studies run on their own, deeper scale. It had no tokens at
        // all before — twelve components each wrote the hexes out by hand.
        page: {
          DEFAULT: c.page,
          deep: c["page-deep"],
          slot: c["page-slot"],
          ink: c["page-ink"],
          "ink-bright": c["page-ink-bright"],
          body: c["page-body"],
          meta: c["page-meta"],
          muted: c["page-muted"],
          caption: c["page-caption"],
          faint: c["page-faint"],
          rule: c["page-rule"],
          "rule-strong": c["page-rule-strong"],
        },
        "on-acid": {
          ink: c["on-acid-ink"],
          muted: c["on-acid-muted"],
          rule: c["on-acid-rule"],
        },
        "on-charcoal": { link: c["on-charcoal-link"] },
        // Near-black ink, used on acid and on white. Not `charcoal` — that is
        // the footer's ground at #202020 and means something else.
        "ink-hard": c["ink-hard"],
        cursor: { hover: c["cursor-hover"], follower: c["cursor-follower"] },
      },
      // The type scale, from the same tokens the CSS custom properties are
      // generated from. Until now these existed in tokens.json and nothing
      // read them — every size on the site was written as an arbitrary value
      // like `text-[clamp(17px,1.5vw,21px)] leading-[1.6]`, which is the same
      // number in three places and a design file that cannot change it.
      //
      // Each entry carries its own line-height and tracking, so `text-body-l`
      // sets all three and the call site stops restating them.
      fontSize: Object.fromEntries(
        Object.entries(tokens.type).map(([name, t]) => [
          name,
          [
            t.min === t.max ? `${t.max}px` : `clamp(${t.min}px, ${t.fluid}, ${t.max}px)`,
            {
              lineHeight: String(t.lineHeight),
              // `0` and `normal` both render identically, but they are
              // different computed values — emitting `0` where the page
              // previously inherited `normal` would show up as a diff on every
              // paragraph and bury a real change in the noise.
              letterSpacing: t.tracking === 0 || t.tracking === '0' ? 'normal' : t.tracking,
            },
          ],
        ]),
      ),
      spacing: {
        grid: `${tokens.space.lattice}px`,
        pixel: `${tokens.space.pixel}px`,
        ...Object.fromEntries(
          Object.entries(tokens.space).map(([k, v]) => [`t${k}`, `${v}px`]),
        ),
      },
      boxShadow: {
        hard: tokens.effect["shadow-hard"],
        "hard-sm": tokens.effect["shadow-hard-sm"],
        "hard-acid": tokens.effect["shadow-hard-acid"],
      },
      transitionTimingFunction: { cta: tokens.motion["ease-cta"] },
      transitionDuration: {
        fast: `${tokens.motion["duration-fast"]}ms`,
        cta: `${tokens.motion["duration-cta"]}ms`,
        swap: `${tokens.motion["duration-swap"]}ms`,
      },
    },
  },
  plugins: [],
};
