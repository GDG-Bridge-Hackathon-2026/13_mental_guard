import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#faf9f5",
        panel: "#ffffff",
        ink: {
          DEFAULT: "#1a1814",
          mute: "#57544c",
          dim: "#908a7e",
        },
        line: "#ece9e0",
        accent: {
          DEFAULT: "#c4634c",
          soft: "#f4ebe0",
          ring: "rgba(196, 99, 76, 0.25)",
        },
        bubble: {
          incoming: "#ffffff",
          outgoing: "#1a1814",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 18, 14, 0.04), 0 4px 16px rgba(20, 18, 14, 0.04)",
        bubble: "0 1px 2px rgba(20, 18, 14, 0.04)",
      },
      borderRadius: {
        bubble: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
