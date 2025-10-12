import React from "react";

// Este componente renderiza o logo da aplicação.
// Ele pode ser reutilizado em diferentes partes da interface, como no cabeçalho ou nas páginas de login.
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg
        width="32"
        height="32"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="skewX(-10) rotate(-5 50 50)">
          <path
            d="M20 18 H 60 A 12 12 0 0 1 72 30 V 78 A 12 12 0 0 1 60 90 H 20 A 12 12 0 0 1 8 78 V 30 A 12 12 0 0 1 20 18 Z"
            fill="#334155"
            opacity="0.5"
          />
          <path
            d="M30 15 H 70 A 12 12 0 0 1 82 27 V 75 A 12 12 0 0 1 70 87 H 30 A 12 12 0 0 1 18 75 V 27 A 12 12 0 0 1 30 15 Z"
            fill="#334155"
          />
          <path
            d="M40 12 H 80 A 12 12 0 0 1 92 24 V 72 A 12 12 0 0 1 80 84 H 40 A 12 12 0 0 1 28 72 V 24 A 12 12 0 0 1 40 12 Z"
            fill="#1E9E6A"
          />
          <path
            d="M52 48 L63 59 L82 40"
            stroke="white"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <span className="text-xl font-bold text-gray-800 dark:text-white">
        CogniCard
      </span>
    </div>
  );
}

export default Logo;
