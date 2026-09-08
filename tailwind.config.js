/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    fontFamily: {
      offbit101: ["OffBit-101"],
      offbit101Bold: ["OffBit-101-Bold"],
      offbit: ["OffBit-Regular"],
      offbitBold: ["OffBit-Bold"],
      offbitDot: ["OffBit-Dot"],
      plumpelo: ["Plumpelo"],
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
