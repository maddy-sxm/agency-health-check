import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Shared SpeedX assessment-ecosystem palette — same tokens as the
        // Revenue Activation Plan tool (revenue-activation-plan.speedxmedia.com):
        // near-black ground, coral-red accent, uppercase display type.
        ink: "#000000",
        "ink-2": "#0d0d0d",
        "ink-3": "#171717",
        line: "#2a2a2a",
        // "red" already exists in Tailwind's default palette as a shade
        // object — override it with a DEFAULT/bright shape rather than a
        // plain string, or bg-red/text-red silently fail to generate.
        red: { DEFAULT: "#d9573b", bright: "#ff6b4a" },
        bone: "#f5f5f5",
        smoke: "#8f8f8f",
        keep: { DEFAULT: "#1fbf6b", bright: "#2ee27f" },
        amber: { DEFAULT: "#e8a33d", bright: "#ffc266" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Arial Black", "sans-serif"],
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "fade-up": "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 0.5s ease-out both",
        "reveal-scale": "revealScale 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pop-in": "popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "pulse-soft": "pulseSoft 1.8s ease-in-out infinite",
        "radar-spin": "radarSpin 2.2s linear infinite",
        "radar-ping": "radarPing 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        revealScale: {
          from: { opacity: "0", transform: "scale(0.92) translateY(10px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        popIn: {
          from: { opacity: "0", transform: "scale(0.9)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        radarSpin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        radarPing: {
          "0%": { opacity: "0.5", transform: "scale(0.4)" },
          "80%": { opacity: "0" },
          "100%": { opacity: "0", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
