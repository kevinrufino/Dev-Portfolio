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
