import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        grotesk: ["var(--font-grotesk)", "Space Grotesk", "sans-serif"],
        mono: ["var(--font-mono)", "Space Mono", "monospace"],
        roboto: ["var(--font-roboto)", "Roboto", "sans-serif"],
      },
      colors: {
        yellow: { DEFAULT: "#FFE600", dim: "rgba(255,230,0,0.10)" },
        coral:  { DEFAULT: "#E84B5A", dim: "rgba(232,75,90,0.12)"  },
        dusk:   {
          DEFAULT: "#08080F",
          50:      "#F0F0F8",
          100:     "#D0D0E8",
          200:     "#8888A0",
          300:     "#444455",
          400:     "#252535",
          500:     "#1E1E2E",
          600:     "#161625",
          700:     "#0F0F1A",
          800:     "#08080F",
        },
        /* Legacy ink colours for backward compat */
        ink: {
          DEFAULT: "#0F0F1A",
          950: "#08080F",
          900: "#0F0F1A",
          700: "#161625",
          500: "#333348",
          300: "#8888A0",
          100: "#D0D0E8",
          50:  "#F0F0F8"
        },
        mist:   "#F0F0F8",
        line:   "#252535",
        pine:   "#10B981",
        signal: "#E84B5A",
        amber:  "#F59E0B"
      },
      boxShadow: {
        soft:     "0 1px 3px rgba(8,8,15,0.4), 0 0 0 2px rgba(37,37,53,0.6)",
        elevated: "0 4px 16px rgba(8,8,15,0.5), 0 0 0 2px rgba(37,37,53,0.6)",
        yellow:   "0 0 20px rgba(255,230,0,0.22)",
      }
    }
  },
  plugins: []
};

export default config;
