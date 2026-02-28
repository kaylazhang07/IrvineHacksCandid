import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: "#080C17",
        gold: "#E8B84B",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "noise": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-2%, -2%)" },
          "20%": { transform: "translate(2%, 2%)" },
          "30%": { transform: "translate(-1%, 1%)" },
          "40%": { transform: "translate(1%, -1%)" },
          "50%": { transform: "translate(-2%, 1%)" },
          "60%": { transform: "translate(2%, -2%)" },
          "70%": { transform: "translate(-1%, 2%)" },
          "80%": { transform: "translate(1%, 1%)" },
          "90%": { transform: "translate(-2%, -1%)" },
        },
      },
      animation: {
        ticker: "ticker 28s linear infinite",
        "fade-up": "fade-up 0.7s ease forwards",
        noise: "noise 0.15s steps(1) infinite",
      },
    },
  },
  plugins: [],
};
export default config;
