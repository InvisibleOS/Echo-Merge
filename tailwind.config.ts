import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Civic/institutional palette — deliberately not the generic
        // AI-demo cream+terracotta look. Deep indigo reads as
        // "official record", warm amber as the human/citizen signal.
        ink: {
          950: "#0B1120", // near-black indigo, page background (dashboard)
          900: "#111827",
          800: "#1F2937",
        },
        civic: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          400: "#818CF8",
          500: "#4F46E5", // primary — buttons, active states
          600: "#4338CA",
          700: "#3730A3",
        },
        signal: {
          amber: "#F59E0B", // citizen-voice accent — used sparingly
          red: "#DC2626", // critical urgency only
          green: "#16A34A", // low urgency / success
        },
        paper: "#FAFAF9", // citizen app background — warm, approachable, high contrast for outdoor mobile use
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
