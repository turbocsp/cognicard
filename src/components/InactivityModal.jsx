// src/components/InactivityModal.jsx
import React from 'react';

export function InactivityModal({ isOpen, onContinue, onRestartQuestion }) {
  if (!isOpen) {
    return null;
  }

  // Impede o fechamento ao clicar dentro do modal
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-auto text-center"
        onClick={handleModalClick}
      >
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          ⏰ Alerta de Inatividade
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Você está aí? Detectamos um período de inatividade. O contador foi pausado.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={onContinue}
            className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition-colors w-full sm:w-auto"
          >
            Continuar de onde parei
          </button>
          <button
            onClick={onRestartQuestion}
            className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors w-full sm:w-auto"
          >
            Reiniciar Questão
            <span className="block text-xs opacity-80">(Descontar tempo)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
