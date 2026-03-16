import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "'Segoe UI'", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(13, 148, 136, 0.22), 0 8px 26px rgba(13, 148, 136, 0.24)"
      }
    }
  },
  plugins: []
} satisfies Config;
