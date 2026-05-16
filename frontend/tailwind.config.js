/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        secondary: "#10B981",
        background: "#0F172A",
        surface: "#1E293B",
        text: "#F8FAFC",
        danger: "#EF4444"
      }
    },
  },
  plugins: [],
}
