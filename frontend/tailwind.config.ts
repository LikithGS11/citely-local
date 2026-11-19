import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Single confident accent — used sparingly (primary actions, active nav, focus rings).
        // Solid backgrounds/low-opacity chips stay the same hue in both themes; only
        // `accent-text` (below) needs a different step per theme for contrast.
        accent: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        // Backward-compatible alias so existing bg-enterprise-* classes still resolve
        enterprise: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        // Theme-aware surface/text roles — driven by CSS variables (globals.css) so
        // every existing bg-dark-*/text-ink-* class flips between light and dark
        // automatically. Names are historical (kept so no component needed renaming).
        dark: {
          bg: "rgb(var(--color-surface-0) / <alpha-value>)",
          card: "rgb(var(--color-surface-1) / <alpha-value>)",
          border: "rgb(var(--color-border) / <alpha-value>)",
          accent: "rgb(var(--color-surface-2) / <alpha-value>)",
        },
        ink: {
          primary: "rgb(var(--color-ink-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-ink-secondary) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
        },
        // Theme-aware wash for hover states/subtle fills — replaces raw white/N,
        // which is invisible once the surface underneath turns light.
        overlay: "rgb(var(--color-overlay) / <alpha-value>)",
        // Theme-aware accent when used as TEXT/icon color (not a solid button bg) —
        // dark mode wants a lighter step to pop on dark surfaces, light mode wants a
        // darker step for contrast on light surfaces.
        "accent-text": "rgb(var(--color-accent-text) / <alpha-value>)",
        // Fixed status roles — never themed, never reused for arbitrary decoration
        status: {
          good: "#16a34a",
          warning: "#f5a524",
          serious: "#ec835a",
          critical: "#e5484d",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.1rem",
      },
      boxShadow: {
        "glow-blue": "0 0 0 1px rgba(59,130,246,0.15), 0 8px 24px -8px rgba(59,130,246,0.35)",
        card: "0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
