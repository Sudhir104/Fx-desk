import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#EEF1F5", panel: "#FFFFFF", soft: "#F6F8FB", line: "#D8DDE5",
        ink: "#111827", muted: "#5B6575", navy: "#12284C", navy2: "#1B3A6B",
        bull: "#0F7B5F", bear: "#B42318", amber: "#B26A00",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
