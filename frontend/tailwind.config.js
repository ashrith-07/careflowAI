/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cf: {
          bg: "#050B18",
          panel: "#0A1628",
          purple: "#6C63FF",
          teal: "#00D4AA",
          amber: "#F59E0B",
          coral: "#FF6B6B",
          text: "#F0F4FF",
          muted: "#8892A4",
        },
      },
      boxShadow: {
        "glow-purple": "0 0 40px rgba(108, 99, 255, 0.35)",
        "glow-teal": "0 0 40px rgba(0, 212, 170, 0.3)",
      },
      letterSpacing: {
        hud: "0.2em",
        wide: "0.12em",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.5s ease-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
