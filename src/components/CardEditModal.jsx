// src/components/CardEditModal.jsx
import { useState, useEffect } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export function CardEditModal({
  isOpen,
  onClose,
  card,
  onSave,
  isSaving = false, // <<< 1. Adicionar prop
}) {
  const [title, setTitle] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [theory, setTheory] = useState("");
  const [sources, setSources] = useState("");
  const [tags, setTags] = useState("");
  const [activeTab, setActiveTab] = useState("front");

  useEffect(() => {
    if (card) {
      setTitle(card.title || "");
      setFront(card.front_content || "");
      setBack(card.back_content || "");
      setTheory(card.theory_notes || "");
      setSources(card.source_references?.join(", ") || "");
      setTags(card.tags?.join(", ") || "");
      setActiveTab("front");
    }
  }, [card, isOpen]);

  const handleSave = () => {
    if (isSaving) return; // Prevenir cliques duplos
    onSave({
      ...card,
      title: title.trim() || null,
      front_content: front,
      back_content: back,
      theory_notes: theory,
      source_references: sources
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  if (!isOpen) return null;

  const renderEditor = () => {
    let value, setter;
    switch (activeTab) {
      case "back":
        value = back;
        setter = setBack;
        break;
      case "theory":
        value = theory;
        setter = setTheory;
        break;
      default:
        value = front;
        setter = setFront;
    }

    return (
      <div className="grid grid-cols-2 gap-4 h-64">
        <textarea
          value={value}
          onChange={(e) => setter(e.target.value)}
          // <<< 2. Desabilitar enquanto guarda >>>
          disabled={isSaving}
          className="w-full h-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 disabled:opacity-50"
        />
        <div className="w-full h-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 overflow-y-auto">
          <MarkdownRenderer content={value} />
        </div>
      </div>
    );
  };

  const TabButton = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
       // <<< 3. Desabilitar enquanto guarda >>>
      disabled={isSaving}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
        activeTab === tabName
          ? "bg-blue-600 text-white"
          : "bg-gray-200 dark:bg-gray-600"
      } disabled:opacity-50`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl">
        <h2 className="text-xl font-bold mb-4">Editar Cartão</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Título (Opcional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
             // <<< 4. Desabilitar enquanto guarda >>>
            disabled={isSaving}
            className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 disabled:opacity-50"
          />
        </div>

        <div className="mb-4 border-b border-gray-300 dark:border-gray-600">
          <div className="flex">
            <TabButton tabName="front" label="Frente" />
            <TabButton tabName="back" label="Verso" />
            <TabButton tabName="theory" label="Teoria" />
          </div>
        </div>

        {renderEditor()}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fontes</label>
            <input
              type="text"
              value={sources}
              onChange={(e) => setSources(e.target.value)}
              placeholder="Separadas por vírgula"
               // <<< 5. Desabilitar enquanto guarda >>>
              disabled={isSaving}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Separadas por vírgula"
               // <<< 6. Desabilitar enquanto guarda >>>
              disabled={isSaving}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
             // <<< 7. Desabilitar enquanto guarda >>>
            disabled={isSaving}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-md disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
             // <<< 8. Desabilitar e mudar texto >>>
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-75 disabled:bg-blue-400"
          >
            {isSaving ? "A guardar..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
