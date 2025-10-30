export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isConfirming = false, // <<< 1. Adicionar nova prop com valor padrão
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">{message}</p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            // <<< 2. Desabilitar "Cancelar" enquanto confirma >>>
            disabled={isConfirming} 
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            // <<< 3. Desabilitar "Confirmar" e mudar texto >>>
            disabled={isConfirming}
            className="px-4 py-2 bg-red-600 text-white rounded-md font-semibold hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isConfirming ? "A excluir..." : "Confirmar"} 
          </button>
        </div>
      </div>
    </div>
  );
}
