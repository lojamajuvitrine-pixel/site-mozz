import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mozz: {
          black: "#111111",
          white: "#ffffff",
          stone: "#f4f3f1",
          gray: "#8a8a86"
        }
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Helvetica", "Arial", "sans-serif"]
      },
      letterSpacing: {
        widest2: "0.25em"
      }
    }
  },
  plugins: []
};
export default config;
