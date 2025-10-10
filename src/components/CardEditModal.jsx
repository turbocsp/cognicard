import { useState, useEffect } from "react";

export function CardEditModal({ isOpen, onClose, onSave, card }) {
  const [frontContent, setFrontContent] = useState("");
  const [backContent, setBackContent] = useState("");
  const [theory, setTheory] = useState("");
  const [sourceReferences, setSourceReferences] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (card) {
      setFrontContent(card.front_content || "");
      setBackContent(card.back_content || "");
      setTheory(card.theory_notes || "");
      setSourceReferences((card.source_references || []).join(", "));
      setTags((card.tags || []).join(", "));
    }
  }, [card]);

  if (!isOpen || !card) {
    return null;
  }

  const handleSave = () => {
    const updatedCard = {
      ...card,
      front_content: frontContent,
      back_content: backContent,
      theory_notes: theory,
      source_references: sourceReferences
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    onSave(updatedCard);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Editar Cartão</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="front" className="block text-sm font-medium mb-1">
              Frente (Pergunta)
            </label>
            <textarea
              id="front"
              value={frontContent}
              onChange={(e) => setFrontContent(e.target.value)}
              rows={3}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="back" className="block text-sm font-medium mb-1">
              Verso (Resposta)
            </label>
            <textarea
              id="back"
              value={backContent}
              onChange={(e) => setBackContent(e.target.value)}
              rows={3}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="theory" className="block text-sm font-medium mb-1">
              Teoria
            </label>
            <textarea
              id="theory"
              value={theory}
              onChange={(e) => setTheory(e.target.value)}
              rows={2}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="sources" className="block text-sm font-medium mb-1">
              Fontes (separadas por vírgula)
            </label>
            <input
              type="text"
              id="sources"
              value={sourceReferences}
              onChange={(e) => setSourceReferences(e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="tags" className="block text-sm font-medium mb-1">
              Tags (separadas por vírgula)
            </label>
            <input
              type="text"
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
