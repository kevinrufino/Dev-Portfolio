/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // Plumpelo sits behind every OffBit face on purpose. The OffBit cut in
    // public/fonts is the trial: 68 glyphs, letters and figures and nothing
    // else — no apostrophe, no comma, no full stop, no question mark. A
    // browser falls back per GLYPH rather than per family, so anything OffBit
    // cannot draw is drawn by the next family that can, and "Let's connect."
    // stops losing its apostrophe to a missing-glyph box.
    //
    // "OffBit Punctuation" is Plumpelo, restricted to punctuation and scaled to
    // OffBit's cap height — see the @font-face in index.css for why it is a
    // separate family rather than Plumpelo itself. The sans at the end catches
    // en dash, em dash and ellipsis, which neither face has; nothing set in
    // OffBit uses them today (checked, not assumed).
    fontFamily: {
      offbit101: ["OffBit-101", "OffBit Punctuation", "sans-serif"],
      offbit101Bold: ["OffBit-101-Bold", "OffBit Punctuation", "sans-serif"],
      offbit: ["OffBit-Regular", "OffBit Punctuation", "sans-serif"],
      offbitBold: ["OffBit-Bold", "OffBit Punctuation", "sans-serif"],
      offbitDot: ["OffBit-Dot", "OffBit Punctuation", "monospace"],
      plumpelo: ["Plumpelo", "sans-serif"],
      sans: ["DM Sans", "sans-serif"],
    },
    extend: {
      colors: {
        acid: "#F1F43B",
        ultra: "#3e3bf4",
        paper: {
          DEFAULT: "#f7f8f5",
          ink: "#252c24",
          muted: "#5d6259",
          rule: "#e0e3dc",
        },
        charcoal: {
          DEFAULT: "#202020",
          ink: "#f0efeb",
          muted: "#b0afa9",
          rule: "#454540",
        },
        "palm-gold": "#ebc035",
      },
      spacing: {
        grid: "6px",
      },
      boxShadow: {
        hard: "6px 6px 0 0 #3e3bf4",
        "hard-sm": "3px 3px 0 0 #3e3bf4",
        "hard-acid": "6px 6px 0 0 #F1F43B",
      },
    },
  },
  plugins: [],
};
