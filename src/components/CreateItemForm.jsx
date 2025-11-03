// src/components/CreateItemForm.jsx
import { useState } from "react";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import deckService from "@/services/deckService";
import folderService from "@/services/folderService";

// A função renderFolderOptions foi movida para cá
function renderFolderOptions(nodes, depth = 0) {
  let options = [];
  nodes.forEach((node) => {
    if (node.type === "folder") {
      options.push(
        <option key={node.id} value={node.id}>
          {" "}
          {"—".repeat(depth)} {node.name}{" "}
        </option>
      );
      if (node.children) {
        options = options.concat(renderFolderOptions(node.children, depth + 1));
      }
    }
  });
  return options;
}

export function CreateItemForm({
  userId,
  folders,
  decks,
  treeData,
  onItemCreated,
}) {
  const queryClient = useQueryClient();
  const [newItemName, setNewItemName] = useState("");
  const [newParentFolderId, setNewParentFolderId] = useState("root");

  // Invalida o cache de pastas e baralhos
  const invalidateDashboardCache = () => {
    queryClient.invalidateQueries({ queryKey: ["folders", userId] });
    queryClient.invalidateQueries({ queryKey: ["decks", userId] });
  };

  const createItemMutation = useMutation({
    mutationFn: async ({ type, payload }) => {
      if (type === "deck") {
        return deckService.createDeck(payload);
      } else {
        return folderService.createFolder(payload);
      }
    },
    onSuccess: (data, { type }) => {
      toast.success(
        `${type === "deck" ? "Baralho" : "Pasta"} criado com sucesso!`
      );
      invalidateDashboardCache();
      setNewItemName("");
      const parentId = data.folder_id || data.parent_folder_id;
      if (parentId) {
        onItemCreated(parentId); // Chama o callback para abrir a pasta
      }
    },
    onError: (error, { type }) => {
      if (error?.code === "23505") {
        toast.error(
          `Já existe ${
            type === "deck" ? "um baralho" : "uma pasta"
          } com este nome neste local.`
        );
      } else {
        toast.error(error.message || `Erro ao criar ${type}.`);
      }
    },
  });
  const isCreating = createItemMutation.isPending;

  const handleCreate = (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      toast.error("O nome não pode estar vazio.");
      return;
    }

    const parentId = newParentFolderId === "root" ? null : newParentFolderId;

    // Lógica de validação (usa props 'folders' e 'decks')
    const siblings =
      type === "folder"
        ? folders.filter((f) => f.parent_folder_id === parentId)
        : decks.filter((d) => d.folder_id === parentId);

    if (
      siblings.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      toast.error(`Já existe um item com o nome "${trimmedName}" neste local.`);
      return;
    }

    const payload = { name: trimmedName, user_id: userId };
    if (type === "deck") payload.folder_id = parentId;
    if (type === "folder") payload.parent_folder_id = parentId;

    createItemMutation.mutate({ type, payload });
  };

  return (
    <div
      className="lg:col-span-1 space-y-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Criar Novo Item</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Nome do Item</label>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Ex: Biologia Celular"
            disabled={isCreating}
            className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Localização</label>
          <select
            value={newParentFolderId}
            onChange={(e) => setNewParentFolderId(e.target.value)}
            disabled={isCreating}
            className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          >
            <option value="root">Raiz</option>
            {/* Usa a prop 'treeData' para renderizar as opções */}
            {renderFolderOptions(treeData)}
          </select>
        </div>
        <div className="flex space-x-4 mt-6">
          <button
            onClick={(e) => handleCreate("deck", e)}
            disabled={isCreating || !newItemName}
            className="flex-1 bg-blue-800 hover:bg-blue-900 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-md disabled:opacity-75 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? "A criar..." : "Criar Baralho"}
          </button>
          <button
            onClick={(e) => handleCreate("folder", e)}
            disabled={isCreating || !newItemName}
            className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-75 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? "A criar..." : "Criar Pasta"}
          </button>
        </div>
      </div>
    </div>
  );
}
