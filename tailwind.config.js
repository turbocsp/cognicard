/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class", // Habilita o modo escuro baseado em classe
  theme: {
    extend: {
      colors: {
        gray: {
          50: "#f8fafc", // Fundo mais suave para o modo claro
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
