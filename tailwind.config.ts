import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0b1530", soft: "#44506b", mute: "#7a8499" },
        navy: { DEFAULT: "#071b45", 600: "#0c2a66", 50: "#eef2fa" },
        accent: { DEFAULT: "#1f7bff", soft: "#e8f1ff" },
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
