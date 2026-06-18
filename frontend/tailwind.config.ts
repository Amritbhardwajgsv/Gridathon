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
        roboto: ["var(--font-roboto)", "Roboto", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#172126",
          950: "#0E1117",
          900: "#172126",
          700: "#1E2535",
          500: "#3A4358",
          300: "#7A8499",
          100: "#C8CDD9",
          50: "#EEF0F5"
        },
        mist: "#F6F7F9",
        line: "#DDE1EA",
        pine: "#0F7B6C",
        signal: "#E8531A",
        amber: "#C47D0A"
      },
      boxShadow: {
        soft: "0 1px 3px rgba(14,17,23,0.08), 0 0 0 1px rgba(14,17,23,0.06)",
        elevated: "0 4px 16px rgba(14,17,23,0.12), 0 0 0 1px rgba(14,17,23,0.06)"
      }
    }
  },
  plugins: []
};

export default config;
