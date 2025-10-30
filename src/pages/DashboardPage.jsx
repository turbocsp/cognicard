// src/pages/DashboardPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { InlineEdit } from "@/components/InlineEdit";
import { ContextMenu } from "@/components/ContextMenu";
import { MoveDeckModal } from "@/components/MoveDeckModal";
import { MoveFolderModal } from "@/components/MoveFolderModal";
import { Link } from "react-router-dom";
import GlobalSearch from "@/components/GlobalSearch";
import ActivityCalendar from "@/components/ActivityCalendar";
import DailySummaryModal from "@/components/DailySummaryModal";
import Clock from "@/components/Clock";

import deckService from "@/services/deckService";
import folderService from "@/services/folderService";
import { supabase } from "@/supabaseClient";

export function DashboardPage() {
  const { session } = useAuth();

  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState([]);

  const [newItemName, setNewItemName] = useState("");
  const [newParentFolderId, setNewParentFolderId] = useState("root");
  
  // Estados de loading granular
  const [isCreating, setIsCreating] = useState(false); 
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false); // <<< 1. Adicionar estado de Mover
  const [isRenamingId, setIsRenamingId] = useState(null); // <<< 2. Adicionar estado de Renomear (por ID)


  const [itemToDelete, setItemToDelete] = useState(null);
  const [deckToMove, setDeckToMove] = useState(null);
  const [folderToMove, setFolderToMove] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [openFolders, setOpenFolders] = useState(new Set());
  const [touchTimeout, setTouchTimeout] = useState(null);

  const [streakData, setStreakData] = useState({
    current_streak: 0,
    longest_streak: 0,
  });
  const [activityData, setActivityData] = useState([]);
  const [activityView, setActivityView] = useState("week");
  const [currentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    // ... (função sem alterações)
     if (!session?.user?.id) return;
    setLoading(true);

    try {
        const [deckData, folderData, streakResult, activityResult] = await Promise.all([
            deckService.getUserDecks(session.user.id),
            folderService.getUserFolders(session.user.id),
            supabase
                .rpc("get_study_streak", { p_user_id: session.user.id })
                .single(),
            supabase
                .rpc("get_study_activity", {
                    p_user_id: session.user.id,
                    p_year: currentYear,
                })
        ]);

        setDecks(deckData);
        setFolders(folderData);

        if (streakResult.error) toast.error(`Streak Error: ${streakResult.error.message}`);
        else if (streakResult.data) setStreakData(streakResult.data);

        if (activityResult.error) toast.error(`Activity Error: ${activityResult.error.message}`);
        else setActivityData(activityResult.data || []);

    } catch (error) {
        toast.error(error.message || "Erro ao carregar dados do painel.");
        setDecks([]);
        setFolders([]);
        setStreakData({ current_streak: 0, longest_streak: 0 });
        setActivityData([]);
    } finally {
        setLoading(false);
    }
  }, [session, currentYear]);


  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // useEffect para construir a árvore (sem alterações)
  useEffect(() => {
     // ... (código existente)
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
          if (parent.children) parent.children.push(node);
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
        if (node.children) node.children.sort(sortNodes);
      });
      tree.sort(sortNodes);
      return tree;
    };
    setTreeData(buildTree(folders, decks));
  }, [folders, decks]);

  // handleCreate (atualizado na etapa anterior, sem novas alterações)
  const handleCreate = async (type, e) => {
     // ... (código existente)
    e.preventDefault();
    e.stopPropagation();
    const trimmedName = newItemName.trim();
    if (!trimmedName) {
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
        (s) => s.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      toast.error(
        `Já existe um item com o nome "${trimmedName}" neste local.`
      );
      return;
    }

    setIsCreating(true);
    const payload = { name: trimmedName, user_id: session.user.id };
    if (type === "deck") payload.folder_id = parentId;
    if (type === "folder") payload.parent_folder_id = parentId;

    try {
        if (type === 'deck') {
            await deckService.createDeck(payload);
        } else {
            await folderService.createFolder(payload);
        }
        toast.success(
            `${type === "deck" ? "Baralho" : "Pasta"} criado com sucesso!`
        );
        setNewItemName("");
        if (parentId) setOpenFolders((prev) => new Set(prev).add(parentId));
        fetchDashboardData();
    } catch (error) {
        toast.error(error.message || `Erro ao criar ${type}.`);
    } finally {
        setIsCreating(false);
    }
  };

  // <<< 3. Atualizar handleRename para usar 'isRenamingId' >>>
  const handleRename = async (newName) => {
    const trimmedNewName = newName.trim();
    if (!editingItemId || !trimmedNewName) {
        setEditingItemId(null);
        return;
    }
    const item =
      folders.find((f) => f.id === editingItemId) ||
      decks.find((d) => d.id === editingItemId);

    if (!item || item.name === trimmedNewName) {
        setEditingItemId(null);
        return;
    }

    const type = "parent_folder_id" in item ? "folder" : "deck";
    const parentId = type === "folder" ? item.parent_folder_id : item.folder_id;

    // Verificação de duplicados (sem alterações)
    const siblingFolders = folders.filter(
      (f) => f.parent_folder_id === parentId && f.id !== editingItemId
    );
    const siblingDecks = decks.filter(
      (d) => d.folder_id === parentId && d.id !== editingItemId
    );
     if (
      (type === "folder" &&
        siblingFolders.some(
          (f) => f.name.toLowerCase() === trimmedNewName.toLowerCase()
        )) ||
      (type === "deck" &&
        siblingDecks.some(
          (d) => d.name.toLowerCase() === trimmedNewName.toLowerCase()
        ))
    ) {
      toast.error(`Já existe um item com o nome "${trimmedNewName}" neste local.`);
      // Não fechar o modal de edição para o utilizador poder corrigir
      return; 
    }

    setIsRenamingId(editingItemId); // <<< Ativa o estado de loading para este ID
    setEditingItemId(null); // <<< Fecha o <InlineEdit>
    setContextMenu(null);

    try {
        if (type === 'deck') {
            await deckService.renameDeck(isRenamingId, trimmedNewName);
        } else {
            await folderService.renameFolder(isRenamingId, trimmedNewName);
        }
        toast.success("Renomeado com sucesso!");
        fetchDashboardData(); // Recarrega
    } catch (error) {
        toast.error(error.message || "Erro ao renomear.");
        // Se der erro, o fetchDashboardData() no finally vai recarregar o nome antigo
    } finally {
        setIsRenamingId(null); // <<< Limpa o estado de loading
    }
  };

  // <<< 4. Atualizar handleMoveDeck para usar 'isMoving' >>>
  const handleMoveDeck = async (newFolderId) => {
    if (!deckToMove) return;

    // Verificação de duplicados (sem alterações)
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
      // Não fechar o modal, permitir ao utilizador corrigir (fechamos o modal após a ação)
      return;
    }

    setIsMoving(true); // <<< Ativa o estado de Mover
    try {
        await deckService.moveDeck(deckToMove.id, newFolderId);
        toast.success(`Baralho movido com sucesso!`);
        fetchDashboardData(); // Recarrega
    } catch(error) {
        toast.error(error.message || "Erro ao mover o baralho.");
    } finally {
        setDeckToMove(null); // Fecha o modal
        setIsMoving(false); // <<< Desativa o estado de Mover
    }
  };

  // <<< 5. Atualizar handleMoveFolder para usar 'isMoving' >>>
  const handleMoveFolder = async (newParentFolderId) => {
    if (!folderToMove) return;

    // Verificação de duplicados (sem alterações)
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
      return; // Não fecha o modal
    }

    setIsMoving(true); // <<< Ativa o estado de Mover
    try {
        await folderService.moveFolder(folderToMove.id, newParentFolderId);
        toast.success(`Pasta movida com sucesso!`);
        fetchDashboardData(); // Recarrega
    } catch(error) {
         toast.error(error.message || "Erro ao mover a pasta.");
    } finally {
        setFolderToMove(null); // Fecha o modal
        setIsMoving(false); // <<< Desativa o estado de Mover
    }
  };

  // handleDelete (atualizado na etapa anterior, sem novas alterações)
  const handleDelete = async () => {
     // ... (código existente)
     if (!itemToDelete) return;
    const { id, type, name } = itemToDelete;

    setIsDeleting(true);
    try {
        if (type === 'deck') {
            await deckService.deleteDeck(id);
        } else {
            await folderService.deleteFolder(id);
        }
         toast.success(`"${name}" foi excluído(a).`);
         fetchDashboardData();
    } catch (error) {
         toast.error(error.message || "Erro ao excluir.");
    } finally {
        setItemToDelete(null);
        setIsDeleting(false);
    }
  };

  // Funções toggleFolder, getContextMenuItems, renderFolderOptions, handleTouch... (sem alterações)
  const toggleFolder = (folderId) => {
     // ... (código existente)
     setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) newSet.delete(folderId);
      else newSet.add(folderId);
      return newSet;
    });
  };

  const getContextMenuItems = () => {
     // ... (código existente)
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
      // <<< 6. Desabilitar "Editar" se já estiver a renomear ESTE item >>>
      action: () => setEditingItemId(item.id),
      disabled: isRenamingId === item.id,
    });
    items.push({
      label: "Mover",
      action: () =>
        item.type === "deck"
          ? setDeckToMove(item.data)
          : setFolderToMove(item.data),
       // <<< 7. Desabilitar "Mover" se estiver a renomear este item (evita conflitos) >>>
      disabled: isRenamingId === item.id,
    });
    items.push({ isSeparator: true });
    items.push({
      label: "Excluir",
      action: () => setItemToDelete(item),
      isDanger: true,
       // <<< 8. Desabilitar "Excluir" se estiver a renomear este item >>>
      disabled: isRenamingId === item.id,
    });
    // Precisamos atualizar o ContextMenu.jsx para lidar com `disabled`
    // (Por agora, vamos focar no FileSystemNode)
    return items;
  };

  const renderFolderOptions = (nodes, depth = 0) => {
     // ... (código existente)
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
     // ... (código existente)
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
     // ... (código existente)
      e.stopPropagation();
    if (touchTimeout) clearTimeout(touchTimeout);
    setTouchTimeout(null);
  };

  // <<< 9. Atualizar FileSystemNode para usar 'isRenamingId' >>>
  const FileSystemNode = ({ node, depth }) => {
    const isEditing = editingItemId === node.id;
    const isRenaming = isRenamingId === node.id; // <<< Verifica se ESTE item está a ser renomeado

    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Não abrir menu de contexto se estiver editando ou renomeando
      if (isEditing || isRenaming) return; 
      setContextMenu({ x: e.clientX, y: e.clientY, item: node });
    };

    if (node.type === "folder") {
      const isOpen = openFolders.has(node.id);
      return (
        <div>
          <div
            className={`flex items-center list-none p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50 ${isEditing || isRenaming ? "" : "cursor-pointer"}`}
            style={{ paddingLeft: `${depth * 20 + 4}px` }}
            onContextMenu={handleContextMenu}
            onTouchStart={(e) => (isEditing || isRenaming ? null : handleTouchStart(e, node))}
            onTouchEnd={handleTouchEnd}
            onClick={() => (isEditing || isRenaming ? null : toggleFolder(node.id))}
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
            ) : isRenaming ? (
               // <<< Estado de loading para renomear >>>
              <span className="font-semibold ml-2 truncate opacity-50 italic">
                A guardar...
              </span>
            ) : (
              <span className="font-semibold ml-2 truncate">{node.name}</span>
            )}
          </div>
          {isOpen &&
            node.children?.map((child) => (
              <FileSystemNode
                key={child.id}
                node={child}
                depth={depth + 1}
                isRenamingId={isRenamingId} // <<< Passar prop para filhos
              />
            ))}
        </div>
      );
    }

    // Deck
    return (
      <div
        className={`flex items-center p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50 ${isRenaming ? "opacity-50" : ""}`}
        style={{
          paddingLeft: depth > 0 ? `${depth * 20 + 4 + 16 + 8}px` : "4px",
        }}
        onContextMenu={handleContextMenu}
        onTouchStart={(e) => (isEditing || isRenaming ? null : handleTouchStart(e, node))}
        onTouchEnd={handleTouchEnd}
      >
        <span className="mr-2 text-blue-400">🃏</span>
        {isEditing ? (
          <InlineEdit
            initialValue={node.name}
            onSave={handleRename}
            onCancel={() => setEditingItemId(null)}
          />
        ) : isRenaming ? (
            // <<< Estado de loading para renomear >>>
           <span className="truncate block w-full opacity-50 italic">
             A guardar...
           </span>
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
  }; // Fim do FileSystemNode

  // --- Renderização ---
  return (
    <div className="min-h-screen pb-8" onClick={() => setContextMenu(null)}>
      <main className="space-y-8">
        {/* Bloco de Atividade */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
           {/* ... (código) ... */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <div>
              <h2 className="text-xl font-bold">Resumo de Atividade</h2>
              <Clock />
            </div>
            <div className="flex items-center gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">
                  🔥 {streakData.current_streak}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Sequência Atual
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  🏆 {streakData.longest_streak}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Maior Sequência
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end items-center gap-2 mb-2">
            <button
              onClick={() => setActivityView("week")}
              className={`px-3 py-1 text-xs rounded-md ${
                activityView === "week"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setActivityView("month")}
              className={`px-3 py-1 text-xs rounded-md ${
                activityView === "month"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => setActivityView("year")}
              className={`px-3 py-1 text-xs rounded-md ${
                activityView === "year"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              Ano
            </button>
          </div>
          <ActivityCalendar
            year={currentYear}
            data={activityData}
            view={activityView}
            onDayClick={(date) => setSelectedDate(date)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Bloco de Decks/Pastas */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow min-h-[400px]">
            <GlobalSearch />
            <div className="mt-4">
              {loading ? (
                <p>Carregando...</p>
              ) : treeData.length === 0 ? (
                 <p className="text-gray-500 dark:text-gray-400 text-center mt-8">Crie sua primeira pasta ou baralho no painel ao lado!</p>
              ) : (
                treeData.map((node) => (
                  <FileSystemNode 
                    key={node.id} 
                    node={node} 
                    depth={0} 
                    isRenamingId={isRenamingId} // <<< 10. Passar estado de loading
                  />
                ))
              )}
            </div>
          </div>
          
          {/* Bloco de Criação (Atualizado) */}
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
                  disabled={isCreating} 
                  className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">
                  Localização
                </label>
                <select
                  value={newParentFolderId}
                  onChange={(e) => setNewParentFolderId(e.target.value)}
                  disabled={isCreating} 
                  className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="root">Raiz</option>
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
        </div>
      </main>

      {/* Context Menu (Sem alterações) */}
       {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()} // A função getContextMenuItems agora pode desabilitar itens
          onClose={() => setContextMenu(null)}
        />
      )}
      {/* Confirmation Modal (Atualizado) */}
      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDelete}
        isConfirming={isDeleting} // Passa o estado
        title={`Excluir ${
          itemToDelete?.type === "folder" ? "Pasta" : "Baralho"
        }`}
        message={`Tem certeza que deseja excluir "${itemToDelete?.name}"? ${
          itemToDelete?.type === "folder"
            ? "Todo o conteúdo aninhado será perdido."
            : ""
        }`}
      />
      {/* Move Modals (Atualizado) */}
      <MoveDeckModal
        isOpen={!!deckToMove}
        onClose={() => setDeckToMove(null)}
        onConfirm={handleMoveDeck}
        isConfirming={isMoving} // <<< 11. Passar estado
        folders={folders}
        currentFolderId={deckToMove?.folder_id || null}
        deckName={deckToMove?.name || ""}
      />
      <MoveFolderModal
        isOpen={!!folderToMove}
        onClose={() => setFolderToMove(null)}
        onConfirm={handleMoveFolder}
        isConfirming={isMoving} // <<< 12. Passar estado
        allFolders={folders}
        folderToMove={folderToMove}
      />
      {/* Daily Summary Modal (Sem alterações) */}
      <DailySummaryModal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        date={selectedDate}
        session={session}
      />
    </div>
  );
}

export default DashboardPage;
