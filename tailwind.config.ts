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
        // Civic/institutional palette
        ink: {
          950: "#0B1120", // near-black indigo, page background (dashboard)
          900: "#111827",
          800: "#1F2937",
        },
        civic: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#4F46E5", // primary — buttons, active states
          600: "#4338CA",
          700: "#3730A3",
        },
        signal: {
          amber: "#F59E0B", // citizen-voice accent
          amberLight: "#FEF3C7",
          red: "#DC2626", // critical urgency
          redLight: "#FEE2E2",
          green: "#16A34A", // low urgency / success
          greenLight: "#DCFCE7",
        },
        surface: {
          50: "#F8FAFC", // clean slate page background
          100: "#F1F5F9",
          200: "#E2E8F0", // minimal borders
          300: "#CBD5E1",
          700: "#334155", // muted typography
          800: "#1E293B",
          900: "#0F172A", // high contrast
        },
        paper: "#FFFFFF",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        "glass": "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
        "glass-sm": "0 4px 16px 0 rgba(31, 38, 135, 0.05)",
        "glow-civic": "0 0 20px rgba(79, 70, 229, 0.35)",
        "glow-amber": "0 0 20px rgba(245, 158, 11, 0.35)",
        "soft": "0 20px 40px -15px rgba(0,0,0,0.05)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        slideUpFade: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "pulse-glow": "pulseGlow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up-fade": "slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
