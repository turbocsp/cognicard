// src/components/MoveDeckModal.jsx
import { useState, useEffect } from "react";

export function MoveDeckModal({
  isOpen,
  onClose,
  onConfirm,
  folders,
  currentFolderId,
  deckName,
  isConfirming = false, // <<< 1. Adicionar prop
}) {
  const [targetFolderId, setTargetFolderId] = useState("root");

  useEffect(() => {
    setTargetFolderId(currentFolderId || "root");
  }, [currentFolderId, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm(targetFolderId === "root" ? null : targetFolderId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Mover Baralho "{deckName}"</h3>
        <div className="space-y-2">
          <label htmlFor="targetFolder" className="block text-sm font-medium">
            Mover para:
          </label>
          <select
            id="targetFolder"
            value={targetFolderId}
            onChange={(e) => setTargetFolderId(e.target.value)}
            // <<< 2. Desabilitar se estiver a confirmar >>>
            disabled={isConfirming} 
            className="w-full px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="root">Nenhuma Pasta (Raiz)</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            // <<< 3. Desabilitar se estiver a confirmar >>>
            disabled={isConfirming}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
             // <<< 4. Desabilitar e mudar texto >>>
            disabled={isConfirming}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-75 disabled:bg-blue-400"
          >
            {isConfirming ? "A mover..." : "Mover"}
          </button>
        </div>
      </div>
    </div>
  );
}
