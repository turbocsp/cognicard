import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { InlineEdit } from "@/components/InlineEdit";
import { ContextMenu } from "@/components/ContextMenu";
import { MoveDeckModal } from "@/components/MoveDeckModal";
import { MoveFolderModal } from "@/components/MoveFolderModal";
import { GlobalSearch } from "@/components/GlobalSearch";

export function DashboardPage() {
  const { session, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState([]);

  const [newItemName, setNewItemName] = useState("");
  const [newParentFolderId, setNewParentFolderId] = useState("root");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [itemToDelete, setItemToDelete] = useState(null);
  const [deckToMove, setDeckToMove] = useState(null);
  const [folderToMove, setFolderToMove] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [openFolders, setOpenFolders] = useState(new Set());
  const [touchTimeout, setTouchTimeout] = useState(null);

  const fetchInitialData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const deckPromise = supabase
      .from("decks")
      .select("*")
      .eq("user_id", session.user.id);
    const folderPromise = supabase
      .from("folders")
      .select("*")
      .eq("user_id", session.user.id);

    const [
      { data: deckData, error: deckError },
      { data: folderData, error: folderError },
    ] = await Promise.all([deckPromise, folderPromise]);

    if (deckError) toast.error(deckError.message);
    else setDecks(deckData || []);

    if (folderError) toast.error(folderError.message);
    else setFolders(folderData || []);

    setLoading(false);
  }, [session]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const buildTree = (folders, decks) => {
      const nodeMap = new Map();
      const tree = [];

      folders.forEach((folder) => {
        nodeMap.set(folder.id, {
          id: folder.id,
          name: folder.name,
          type: "folder",
          children: [],
          data: folder,
        });
      });

      decks.forEach((deck) => {
        nodeMap.set(deck.id, {
          id: deck.id,
          name: deck.name,
          type: "deck",
          data: deck,
        });
      });

      nodeMap.forEach((node) => {
        const parentId =
          node.type === "folder"
            ? node.data.parent_folder_id
            : node.data.folder_id;

        if (parentId && nodeMap.has(parentId)) {
          const parent = nodeMap.get(parentId);
          if (parent.children) {
            parent.children.push(node);
          }
        } else {
          tree.push(node);
        }
      });

      const sortNodes = (a, b) => {
        if (a.type === "folder" && b.type === "deck") return -1;
        if (a.type === "deck" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      };

      nodeMap.forEach((node) => {
        if (node.children) {
          node.children.sort(sortNodes);
        }
      });

      tree.sort(sortNodes);
      return tree;
    };

    setTreeData(buildTree(folders, decks));
  }, [folders, decks]);

  const handleCreate = async (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session || !newItemName.trim()) {
      toast.error("O nome não pode estar vazio.");
      return;
    }

    const parentId = newParentFolderId === "root" ? null : newParentFolderId;
    const siblings =
      type === "folder"
        ? folders.filter((f) => f.parent_folder_id === parentId)
        : decks.filter((d) => d.folder_id === parentId);

    if (
      siblings.some(
        (s) => s.name.toLowerCase() === newItemName.trim().toLowerCase()
      )
    ) {
      toast.error(
        `Já existe um item com o nome "${newItemName.trim()}" neste local.`
      );
      return;
    }

    setIsSubmitting(true);
    const table = type === "deck" ? "decks" : "folders";
    const payload = { name: newItemName.trim(), user_id: session.user.id };
    if (type === "deck") payload.folder_id = parentId;
    if (type === "folder") payload.parent_folder_id = parentId;

    const { error } = await supabase.from(table).insert(payload);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        `${type === "deck" ? "Baralho" : "Pasta"} criado com sucesso!`
      );
      setNewItemName("");
      if (parentId) setOpenFolders((prev) => new Set(prev).add(parentId));
      fetchInitialData();
    }
    setIsSubmitting(false);
  };

  const handleRename = async (newName) => {
    if (!editingItemId) return;

    const item =
      folders.find((f) => f.id === editingItemId) ||
      decks.find((d) => d.id === editingItemId);
    if (!item) return;

    const type = "parent_folder_id" in item ? "folder" : "deck";
    const parentId = type === "folder" ? item.parent_folder_id : item.folder_id;

    const siblingFolders = folders.filter(
      (f) => f.parent_folder_id === parentId && f.id !== editingItemId
    );
    const siblingDecks = decks.filter(
      (d) => d.folder_id === parentId && d.id !== editingItemId
    );

    if (
      (type === "folder" &&
        siblingFolders.some(
          (f) => f.name.toLowerCase() === newName.toLowerCase()
        )) ||
      (type === "deck" &&
        siblingDecks.some(
          (d) => d.name.toLowerCase() === newName.toLowerCase()
        ))
    ) {
      toast.error(`Já existe um item com o nome "${newName}" neste local.`);
      setEditingItemId(null);
      return;
    }

    const { error } = await supabase
      .from(type === "folder" ? "folders" : "decks")
      .update({ name: newName })
      .eq("id", editingItemId);

    if (error) toast.error(error.message);
    else toast.success("Renomeado com sucesso!");

    setEditingItemId(null);
    setContextMenu(null);
    fetchInitialData();
  };

  const handleMoveDeck = async (newFolderId) => {
    if (!deckToMove) return;

    const isDuplicate = decks.some(
      (d) =>
        d.name.toLowerCase() === deckToMove.name.toLowerCase() &&
        d.folder_id === newFolderId &&
        d.id !== deckToMove.id
    );

    if (isDuplicate) {
      toast.error(
        `Já existe um baralho com o nome "${deckToMove.name}" na pasta de destino.`
      );
      setDeckToMove(null);
      return;
    }

    const { error } = await supabase
      .from("decks")
      .update({ folder_id: newFolderId })
      .eq("id", deckToMove.id);

    if (error) toast.error(`Erro ao mover o baralho: ${error.message}`);
    else toast.success(`Baralho movido com sucesso!`);

    setDeckToMove(null);
    fetchInitialData();
  };

  const handleMoveFolder = async (newParentFolderId) => {
    if (!folderToMove) return;

    const isDuplicate = folders.some(
      (f) =>
        f.name.toLowerCase() === folderToMove.name.toLowerCase() &&
        f.parent_folder_id === newParentFolderId &&
        f.id !== folderToMove.id
    );

    if (isDuplicate) {
      toast.error(
        `Já existe uma pasta com o nome "${folderToMove.name}" no destino.`
      );
      setFolderToMove(null);
      return;
    }

    const { error } = await supabase
      .from("folders")
      .update({ parent_folder_id: newParentFolderId })
      .eq("id", folderToMove.id);

    if (error) toast.error(`Erro ao mover a pasta: ${error.message}`);
    else toast.success(`Pasta movida com sucesso!`);

    setFolderToMove(null);
    fetchInitialData();
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const { id, type, name } = itemToDelete;
    const { error } = await supabase
      .from(type === "folder" ? "folders" : "decks")
      .delete()
      .eq("id", id);

    if (error) toast.error(`Erro ao excluir: ${error.message}`);
    else toast.success(`"${name}" foi excluído(a).`);

    setItemToDelete(null);
    fetchInitialData();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const toggleFolder = (folderId) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) newSet.delete(folderId);
      else newSet.add(folderId);
      return newSet;
    });
  };

  const getContextMenuItems = () => {
    if (!contextMenu) return [];
    const { item } = contextMenu;
    const items = [];

    if (item.type === "folder") {
      items.push({
        label: "Nova Pasta Aqui",
        action: () => setNewParentFolderId(item.id),
      });
      items.push({
        label: "Novo Baralho Aqui",
        action: () => setNewParentFolderId(item.id),
      });
      items.push({ isSeparator: true });
    }

    items.push({
      label: "Editar Nome",
      action: () => setEditingItemId(item.id),
    });
    items.push({
      label: "Mover",
      action: () =>
        item.type === "deck"
          ? setDeckToMove(item.data)
          : setFolderToMove(item.data),
    });
    items.push({ isSeparator: true });
    items.push({
      label: "Excluir",
      action: () => setItemToDelete(item),
      isDanger: true,
    });

    return items;
  };

  const renderFolderOptions = (nodes, depth = 0) => {
    let options = [];
    nodes.forEach((node) => {
      if (node.type === "folder") {
        options.push(
          <option key={node.id} value={node.id}>
            {"—".repeat(depth)} {node.name}
          </option>
        );
        if (node.children) {
          options = options.concat(
            renderFolderOptions(node.children, depth + 1)
          );
        }
      }
    });
    return options;
  };

  const handleTouchStart = (e, item) => {
    e.stopPropagation();
    const timeout = setTimeout(() => {
      setContextMenu({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        item,
      });
    }, 500);
    setTouchTimeout(timeout);
  };

  const handleTouchEnd = (e) => {
    e.stopPropagation();
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      setTouchTimeout(null);
    }
  };

  const FileSystemNode = ({ node, depth }) => {
    const isEditing = editingItemId === node.id;
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, item: node });
    };

    if (node.type === "folder") {
      const isOpen = openFolders.has(node.id);
      return (
        <div>
          <div
            className="flex items-center list-none p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50 cursor-pointer"
            style={{ paddingLeft: `${depth * 20 + 4}px` }}
            onContextMenu={handleContextMenu}
            onTouchStart={(e) => handleTouchStart(e, node)}
            onTouchEnd={handleTouchEnd}
            onClick={() => !isEditing && toggleFolder(node.id)}
          >
            <span
              className={`w-4 h-4 transition-transform ${
                isOpen ? "rotate-90" : ""
              }`}
            >
              ▶
            </span>
            <span className="ml-2 text-yellow-400">📁</span>
            {isEditing ? (
              <InlineEdit
                initialValue={node.name}
                onSave={handleRename}
                onCancel={() => setEditingItemId(null)}
              />
            ) : (
              <span className="font-semibold ml-2 truncate">{node.name}</span>
            )}
          </div>
          {isOpen &&
            node.children?.map((child) => (
              <FileSystemNode key={child.id} node={child} depth={depth + 1} />
            ))}
        </div>
      );
    }

    return (
      <div
        className="flex items-center p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50"
        style={{ paddingLeft: `${depth * 20 + 4 + 16 + 8}px` }}
        onContextMenu={handleContextMenu}
        onTouchStart={(e) => handleTouchStart(e, node)}
        onTouchEnd={handleTouchEnd}
      >
        <span className="mr-2 text-blue-400">🃏</span>
        {isEditing ? (
          <InlineEdit
            initialValue={node.name}
            onSave={handleRename}
            onCancel={() => setEditingItemId(null)}
          />
        ) : (
          <Link
            to={`/deck/${node.id}`}
            className="truncate block w-full cursor-pointer"
          >
            {node.name}
          </Link>
        )}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 sm:p-8"
      onClick={() => setContextMenu(null)}
    >
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Painel de Controle</h1>
          <div className="flex items-center gap-4">
            <Link
              to="/stats"
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Estatísticas
            </Link>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {theme === "light" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition"
            >
              Sair
            </button>
          </div>
        </header>

        <GlobalSearch />

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow min-h-[400px]">
            {loading ? (
              <p>Carregando...</p>
            ) : (
              treeData.map((node) => (
                <FileSystemNode key={node.id} node={node} depth={0} />
              ))
            )}
          </div>

          <div
            className="lg:col-span-1 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Criar Novo Item</h2>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nome do Item
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Ex: Biologia Celular"
                  className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">
                  Localização
                </label>
                <select
                  value={newParentFolderId}
                  onChange={(e) => setNewParentFolderId(e.target.value)}
                  className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                >
                  <option value="root">Raiz</option>
                  {renderFolderOptions(treeData)}
                </select>
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  onClick={(e) => handleCreate("deck", e)}
                  disabled={isSubmitting || !newItemName}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-500"
                >
                  Criar Baralho
                </button>
                <button
                  onClick={(e) => handleCreate("folder", e)}
                  disabled={isSubmitting || !newItemName}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-500"
                >
                  Criar Pasta
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDelete}
        title={`Excluir ${
          itemToDelete?.type === "folder" ? "Pasta" : "Baralho"
        }`}
        message={`Tem certeza que deseja excluir "${itemToDelete?.name}"? ${
          itemToDelete?.type === "folder"
            ? "Todo o conteúdo aninhado será perdido."
            : ""
        }`}
      />
      <MoveDeckModal
        isOpen={!!deckToMove}
        onClose={() => setDeckToMove(null)}
        onConfirm={handleMoveDeck}
        folders={folders}
        currentFolderId={deckToMove?.folder_id || null}
        deckName={deckToMove?.name || ""}
      />
      <MoveFolderModal
        isOpen={!!folderToMove}
        onClose={() => setFolderToMove(null)}
        onConfirm={handleMoveFolder}
        allFolders={folders}
        folderToMove={folderToMove}
      />
    </div>
  );
}

export default DashboardPage;
