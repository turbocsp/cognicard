// tailwind.config.js
/** @type {import('tailwindcss').Config} */
const colors = require("tailwindcss/colors"); // Importar as cores do Tailwind

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class", // Mantém o modo escuro baseado em classe
  theme: {
    extend: {
      // Vamos usar 'slate' como a nossa principal paleta de cinza para melhor contraste
      // Você pode ajustar quais tons usar conforme necessário nos seus componentes
      colors: {
        gray: colors.slate, // Substitui a paleta 'gray' padrão pela 'slate'
        // Você pode adicionar cores personalizadas aqui se desejar, por exemplo:
        // 'dark-bg-primary': '#1E293B', // Exemplo: slate-800
        // 'dark-bg-secondary': '#334155', // Exemplo: slate-700
        // 'dark-text-primary': '#F1F5F9', // Exemplo: slate-100
        // 'dark-text-secondary': '#94A3B8', // Exemplo: slate-400
      },
    },
  },
  plugins: [require("@tailwindcss/typography")], // Mantém o plugin de tipografia
};
