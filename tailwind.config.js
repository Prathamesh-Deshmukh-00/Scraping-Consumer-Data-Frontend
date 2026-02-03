/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class", // ✅ Changed to 'class' for broader compatibility
  theme: {
    extend: {
      colors: {
        primary: "#019D6D",
      },
    },
  },
  plugins: [],
};
