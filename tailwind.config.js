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
          slot: c["page-slot"],
          ink: c["page-ink"],
          body: c["page-body"],
          muted: c["page-muted"],
          faint: c["page-faint"],
          rule: c["page-rule"],
        },
        "on-acid": {
          ink: c["on-acid-ink"],
          muted: c["on-acid-muted"],
          rule: c["on-acid-rule"],
        },
        "on-charcoal": { link: c["on-charcoal-link"] },
      },
      spacing: {
        grid: `${tokens.space.lattice}px`,
        pixel: `${tokens.space.pixel}px`,
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
