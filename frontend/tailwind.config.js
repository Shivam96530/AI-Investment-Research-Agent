/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'General Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        border: "#E5E5E5",
        surface: "#FFFFFF",
        bg: "#FAFAFA",
        invest: "#047857",
        investBg: "#D1FAE5",
        pass: "#E11D48",
        passBg: "#FFE4E6",
        riskLow: "#059669",
        riskMedium: "#D97706",
        riskHigh: "#DC2626",
      },
    },
  },
  plugins: [],
};
