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
        enterprise: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7ccbfd",
          400: "#36b2fa",
          500: "#0c97eb",
          600: "#0277c6",
          700: "#035f9f",
          800: "#065083",
          900: "#0b436d",
          950: "#072a47",
        },
        dark: {
          bg: "#0b0f19",
          card: "#131b2e",
          border: "#1f2d4a",
          accent: "#25385e",
        }
      },
      boxShadow: {
        "glow-blue": "0 0 25px -5px rgba(12, 151, 235, 0.4)",
        "glow-purple": "0 0 25px -5px rgba(168, 85, 247, 0.3)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
