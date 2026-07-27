import type { Config } from "tailwindcss";

// "Loop" design system — a clean, light YouTube-style theme.
// Palette is oklch (Loop's own values); accent is indigo #3355CC.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#3355CC",
          hover: "#2b48ad",
          soft: "oklch(0.9 0.05 264)",
        },
        // Surfaces
        paper: "oklch(0.99 0.004 250)", // page background
        panel: "oklch(0.965 0.006 250)", // cards / inputs
        panel2: "oklch(0.98 0.004 250)", // dropzone / subtle fills
        // Text
        ink: {
          DEFAULT: "oklch(0.22 0.015 250)", // primary
          2: "oklch(0.4 0.015 250)", // secondary
          3: "oklch(0.5 0.015 250)", // muted
        },
        // Lines
        line: "oklch(0.9 0.008 250)",
        line2: "oklch(0.88 0.01 250)",
        danger: "oklch(0.5 0.15 25)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        mono: ["var(--font-jbmono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,25,40,0.04), 0 6px 20px -12px rgba(20,25,40,0.12)",
        pop: "0 10px 30px -10px rgba(20,25,40,0.25)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
