import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Near-black navy base — the "black" of the palette.
        ink: {
          DEFAULT: "#070b16",
          800: "#0b1120",
          700: "#0f1930",
        },
        // Five working shades of blue (300→700) plus a near-white tint and a
        // deep navy, so everything on the page reads as one blue family.
        brand: {
          50: "#eaf3ff",
          100: "#cfe3ff",
          300: "#7db4ff", // blue 1 — light
          400: "#4f97ff", // blue 2
          500: "#2f7bf6", // blue 3 — core accent
          600: "#1e5fe0", // blue 4
          700: "#1746b0", // blue 5 — deep
          900: "#0b2560", // deepest navy
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(79,151,255,0.25), 0 20px 60px -20px rgba(47,123,246,0.55)",
        "glow-sm": "0 10px 30px -12px rgba(47,123,246,0.5)",
      },
      keyframes: {
        blob: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -40px) scale(1.1)" },
          "66%": { transform: "translate(-25px, 25px) scale(0.95)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(79,151,255,0.5)" },
          "70%": { boxShadow: "0 0 0 12px rgba(79,151,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(79,151,255,0)" },
        },
      },
      animation: {
        blob: "blob 18s ease-in-out infinite",
        "blob-slow": "blob 26s ease-in-out infinite",
        "gradient-pan": "gradient-pan 6s ease infinite",
        shimmer: "shimmer 1.8s infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
