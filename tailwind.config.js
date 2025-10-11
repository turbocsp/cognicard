/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class", // Habilita o modo escuro baseado em classe
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
