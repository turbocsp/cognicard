import { useState, useEffect } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export function CardEditModal({ isOpen, onClose, card, onSave }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [theory, setTheory] = useState("");
  const [sources, setSources] = useState("");
  const [tags, setTags] = useState("");
  const [activeTab, setActiveTab] = useState("front"); // front, back, theory

  useEffect(() => {
    if (card) {
      setFront(card.front_content || "");
      setBack(card.back_content || "");
      setTheory(card.theory_notes || "");
      setSources(card.source_references?.join(", ") || "");
      setTags(card.tags?.join(", ") || "");
    }
  }, [card]);

  const handleSave = () => {
    onSave({
      ...card,
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
          className="w-full h-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
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
      className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
        activeTab === tabName
          ? "bg-blue-600 text-white"
          : "bg-gray-200 dark:bg-gray-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl">
        <h2 className="text-xl font-bold mb-4">Editar Cartão</h2>

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
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
