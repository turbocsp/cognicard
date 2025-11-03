// src/pages/DashboardPage.jsx
import { useState, useCallback, useRef, useMemo } from "react";
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
import { CreateItemForm } from "@/components/CreateItemForm";
import { FileSystemTree } from "@/components/FileSystemTree";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import deckService from "@/services/deckService";
import folderService from "@/services/folderService";
import { supabase } from "@/supabaseClient";

const HOVER_TO_OPEN_DELAY = 500;

export function DashboardPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const currentYear = new Date().getFullYear();
  const queryClient = useQueryClient();

  // --- Estados de UI ---
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deckToMove, setDeckToMove] = useState(null);
  const [folderToMove, setFolderToMove] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [isRenamingId, setIsRenamingId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [openFolders, setOpenFolders] = useState(new Set());
  const [touchTimeout, setTouchTimeout] = useState(null);
  const [activityView, setActivityView] = useState("week");
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const hoverTimerRef = useRef(null);
  const hoveredFolderIdRef = useRef(null);

  // --- Busca de Dados (useQuery) ---
  const { data: folders = [], isLoading: isLoadingFolders } = useQuery({
    queryKey: ["folders", userId],
    queryFn: () => folderService.getUserFolders(userId),
    enabled: !!userId,
  });

  const { data: decks = [], isLoading: isLoadingDecks } = useQuery({
    queryKey: ["decks", userId],
    queryFn: () => deckService.getUserDecks(userId),
    enabled: !!userId,
  });

  // <<< CORREÇÃO AQUI >>>
  const { data: streakData = { current_streak: 0, longest_streak: 0 } } =
    useQuery({
      queryKey: ["streak", userId],
      queryFn: async () => {
        // Esta função estava em falta
        const { data, error } = await supabase
          .rpc("get_study_streak", { p_user_id: userId }) //
          .single();
        if (error) {
          console.error("Erro ao buscar streak:", error.message);
          // Retorna o default em caso de erro para não quebrar a UI
          return { current_streak: 0, longest_streak: 0 };
        }
        return data;
      },
      enabled: !!userId,
    });

  // <<< CORREÇÃO AQUI >>>
  const { data: activityData = [] } = useQuery({
    queryKey: ["activity", userId, currentYear],
    queryFn: async () => {
      // Esta função estava em falta
      const { data, error } = await supabase.rpc("get_study_activity", {
        //
        p_user_id: userId,
        p_year: currentYear,
      });
      if (error) {
        console.error("Erro ao buscar atividade:", error.message);
        return []; // Retorna default em caso de erro
      }
      return data || [];
    },
    enabled: !!userId,
  });

  const loading = isLoadingFolders || isLoadingDecks;

  // --- Estado Derivado (useMemo) (Inalterado) ---
  const treeData = useMemo(() => {
    // ... (lógica buildTree inalterada) ...
    const buildTree = (foldersData, decksData) => {
      const nodeMap = new Map();
      const tree = [];
      foldersData.forEach((folder) => {
        nodeMap.set(folder.id, {
          id: folder.id,
          name: folder.name,
          type: "folder",
          children: [],
          data: folder,
        });
      });
      decksData.forEach((deck) => {
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
    return buildTree(folders, decks);
  }, [folders, decks]);

  // --- Mutações (Inalteradas) ---
  const invalidateDashboardCache = () => {
    queryClient.invalidateQueries({ queryKey: ["folders", userId] });
    queryClient.invalidateQueries({ queryKey: ["decks", userId] });
  };

  const renameMutation = useMutation({
    // ... (mutação 'rename' inalterada) ...
    mutationFn: async ({ id, newName, type }) => {
      if (type === "deck") {
        return deckService.renameDeck(id, newName);
      } else {
        return folderService.renameFolder(id, newName);
      }
    },
    onSuccess: () => {
      toast.success("Renomeado com sucesso!");
      invalidateDashboardCache();
    },
    onError: (error) => {
      if (error?.code === "23505") {
        toast.error("Um item com este nome já existe neste local.");
      } else {
        toast.error(error.message || "Erro ao renomear.");
      }
    },
    onSettled: () => {
      setIsRenamingId(null);
      setEditingItemId(null);
    },
  });

  const handleRename = async (newName) => {
    // ... (função 'handleRename' inalterada) ...
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
      toast.error(
        `Já existe um item com o nome "${trimmedNewName}" neste local.`
      );
      return;
    }
    setIsRenamingId(editingItemId);
    setEditingItemId(null);
    setContextMenu(null);
    renameMutation.mutate({ type, id: editingItemId, newName: trimmedNewName });
  };

  const moveItemMutation = useMutation({
    // ... (mutação 'move' inalterada) ...
    mutationFn: async ({ item, newParentId, type }) => {
      if (type === "deck") {
        return deckService.moveDeck(item.id, newParentId);
      } else {
        return folderService.moveFolder(item.id, newParentId);
      }
    },
    onSuccess: () => {
      invalidateDashboardCache();
    },
    onError: (error) => {
      if (error?.code === "23505") {
        toast.error("Um item com este nome já existe na pasta de destino.");
      } else {
        toast.error(error.message || "Erro ao mover o item.");
      }
      invalidateDashboardCache();
    },
    onSettled: () => {
      setDeckToMove(null);
      setFolderToMove(null);
    },
  });
  const isMoving = moveItemMutation.isPending;

  const handleMoveDeck = (itemToMove, newFolderId) => {
    // ... (função 'handleMoveDeck' inalterada) ...
    if (!itemToMove || itemToMove.folder_id === newFolderId) {
      setDeckToMove(null);
      return;
    }
    const isDuplicate = decks.some(
      (d) =>
        d.name.toLowerCase() === itemToMove.name.toLowerCase() &&
        d.folder_id === newFolderId &&
        d.id !== itemToMove.id
    );
    if (isDuplicate) {
      toast.error(
        `Já existe um baralho com o nome "${itemToMove.name}" na pasta de destino.`
      );
      setDeckToMove(null);
      return;
    }
    setDeckToMove(null);
    moveItemMutation.mutate({
      item: itemToMove,
      newParentId: newFolderId,
      type: "deck",
    });
  };

  const handleMoveFolder = (itemToMove, newParentFolderId) => {
    // ... (função 'handleMoveFolder' inalterada) ...
    if (!itemToMove || itemToMove.parent_folder_id === newParentFolderId) {
      setFolderToMove(null);
      return;
    }
    if (itemToMove.id === newParentFolderId) {
      toast.error("Não pode mover uma pasta para dentro dela mesma.");
      setFolderToMove(null);
      return;
    }
    const isDuplicate = folders.some(
      (f) =>
        f.name.toLowerCase() === itemToMove.name.toLowerCase() &&
        f.parent_folder_id === newParentFolderId &&
        f.id !== itemToMove.id
    );
    if (isDuplicate) {
      toast.error(
        `Já existe uma pasta com o nome "${itemToMove.name}" no destino.`
      );
      setFolderToMove(null);
      return;
    }
    setFolderToMove(null);
    moveItemMutation.mutate({
      item: itemToMove,
      newParentId: newParentFolderId,
      type: "folder",
    });
  };

  const deleteItemMutation = useMutation({
    // ... (mutação 'delete' inalterada) ...
    mutationFn: async ({ type, id }) => {
      if (type === "deck") {
        return deckService.deleteDeck(id);
      } else {
        return folderService.deleteFolder(id);
      }
    },
    onSuccess: (data, variables) => {
      toast.success(`"${variables.name}" foi excluído(a).`);
      invalidateDashboardCache();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir.");
    },
    onSettled: () => {
      setItemToDelete(null);
    },
  });
  const isDeleting = deleteItemMutation.isPending;

  const handleDelete = () => {
    // ... (função 'handleDelete' inalterada) ...
    if (!itemToDelete) return;
    deleteItemMutation.mutate(itemToDelete);
  };

  const isDisabled = isMoving || isDeleting || !!isRenamingId;

  // --- Funções de UI (Inalteradas) ---
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
    const itemData = item.data;
    const items = [];

    items.push({
      label: "Editar Nome",
      action: () => setEditingItemId(item.id),
      disabled: isDisabled,
    });
    items.push({
      label: "Mover",
      action: () =>
        item.type === "deck"
          ? setDeckToMove(itemData)
          : setFolderToMove(itemData),
      disabled: isDisabled,
    });
    items.push({ isSeparator: true });
    items.push({
      label: "Excluir",
      action: () =>
        setItemToDelete({ ...itemData, type: item.type, name: item.name }),
      isDanger: true,
      disabled: isDisabled,
    });
    return items;
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
    if (touchTimeout) clearTimeout(touchTimeout);
    setTouchTimeout(null);
  };

  // --- Lógica DND-Kit (Inalterada) ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event) => {
    const findNodeById = (nodes, id) => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNodeById(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNodeById(treeData, event.active.id);
    setActiveDragItem(
      node ? { ...node, depth: findDepth(treeData, node.id) } : null
    );
  };

  const findDepth = (nodes, id, depth = 0) => {
    for (const node of nodes) {
      if (node.id === id) return depth;
      if (node.children) {
        const foundDepth = findDepth(node.children, id, depth + 1);
        if (foundDepth !== -1) return foundDepth;
      }
    }
    return -1;
  };

  const handleDragMove = (event) => {
    const { active, over } = event;
    if (!over || over.id === "root") {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
        hoveredFolderIdRef.current = null;
      }
      return;
    }
    const overId = over.id;
    const isFolder = over.data.current?.type === "folder";
    const isOpen = openFolders.has(overId);
    if (!isFolder || isOpen || overId === active.id) {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
        hoveredFolderIdRef.current = null;
      }
      return;
    }
    if (hoveredFolderIdRef.current === overId) {
      return;
    }
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoveredFolderIdRef.current = overId;
    hoverTimerRef.current = setTimeout(() => {
      if (activeDragItem) {
        toggleFolder(overId);
      }
      hoverTimerRef.current = null;
      hoveredFolderIdRef.current = null;
    }, HOVER_TO_OPEN_DELAY);
  };

  const handleDragEnd = (event) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
      hoveredFolderIdRef.current = null;
    }
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) {
      return;
    }
    const draggableId = active.id;
    const droppableId = over.id;
    if (draggableId === droppableId) {
      return;
    }
    const item =
      folders.find((f) => f.id === draggableId) ||
      decks.find((d) => d.id === draggableId);
    if (!item) {
      console.error(
        "Não foi possível encontrar dados do item arrastado:",
        draggableId
      );
      return;
    }
    const newParentId = droppableId === "root" ? null : droppableId;
    if (item.folder_id !== undefined) {
      handleMoveDeck(item, newParentId);
    } else if (
      item.parent_folder_id !== undefined ||
      item.parent_folder_id === null
    ) {
      const getSubfolderIds = (folderId) => {
        let children = folders.filter((f) => f.parent_folder_id === folderId);
        let ids = children.map((c) => c.id);
        children.forEach((c) => {
          ids = [...ids, ...getSubfolderIds(c.id)];
        });
        return ids;
      };
      const disabledFolderIds = [item.id, ...getSubfolderIds(item.id)];
      if (disabledFolderIds.includes(newParentId)) {
        toast.error(
          "Não pode mover uma pasta para dentro dela mesma ou de uma subpasta."
        );
        return;
      }
      handleMoveFolder(item, newParentId);
    }
  };

  const handleDragCancel = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
      hoveredFolderIdRef.current = null;
    }
    setActiveDragItem(null);
  };

  const handleItemCreated = (parentId) => {
    if (parentId) {
      setOpenFolders((prev) => new Set(prev).add(parentId));
    }
  };

  // --- Renderização Principal (JSX) ---
  return (
    <div className="min-h-screen pb-8" onClick={() => setContextMenu(null)}>
      <main className="space-y-8">
        {/* Bloco de Atividade (Agora recebe 'streakData' do useQuery) */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
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
          {/* Agora recebe 'activityData' do useQuery */}
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
            {loading ? (
              <p className="text-center mt-8">Carregando...</p>
            ) : (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragMove={handleDragMove}
                onDragCancel={handleDragCancel}
              >
                <div className="mt-4">
                  <FileSystemTree
                    treeData={treeData}
                    activeDragItem={activeDragItem}
                    // Passa todos os estados e handlers necessários
                    openFolders={openFolders}
                    editingItemId={editingItemId}
                    isRenamingId={isRenamingId}
                    isDisabled={isDisabled}
                    renameMutationPending={renameMutation.isPending}
                    onToggleFolder={toggleFolder}
                    onSetEditingItemId={setEditingItemId}
                    onRename={handleRename}
                    onContextMenu={setContextMenu}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  />
                </div>

                <DragOverlay dropAnimation={null}>
                  {activeDragItem ? (
                    <div className="dragging-item-overlay">
                      {activeDragItem.type === "folder" ? (
                        <div
                          className="flex items-center list-none p-1 rounded-md"
                          style={{
                            paddingLeft: `${
                              (activeDragItem.depth || 0) * 24
                            }px`,
                          }}
                        >
                          <span className="w-6 h-6 flex items-center justify-center">
                            ▶
                          </span>
                          <span className="ml-1 text-yellow-400">📁</span>
                          <span className="font-semibold ml-2 truncate">
                            {activeDragItem.name}
                          </span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center p-1 rounded-md"
                          style={{
                            paddingLeft: `${
                              (activeDragItem.depth || 0) * 24
                            }px`,
                          }}
                        >
                          <span className="w-6 h-6 mr-1 flex items-center justify-center text-blue-400 flex-shrink-0">
                            🃏
                          </span>
                          <span className="truncate block w-full ml-2">
                            {activeDragItem.name}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          {/* Bloco de Criação */}
          <CreateItemForm
            userId={userId}
            folders={folders}
            decks={decks}
            treeData={treeData}
            onItemCreated={handleItemCreated}
          />
        </div>
      </main>

      {/* Modais (Inalterados) */}
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
        isConfirming={isDeleting}
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
        onConfirm={(newFolderId) => handleMoveDeck(deckToMove, newFolderId)}
        isConfirming={isMoving}
        folders={folders}
        currentFolderId={deckToMove?.folder_id || null}
        deckName={deckToMove?.name || ""}
      />
      <MoveFolderModal
        isOpen={!!folderToMove}
        onClose={() => setFolderToMove(null)}
        onConfirm={(newParentFolderId) =>
          handleMoveFolder(folderToMove, newParentFolderId)
        }
        isConfirming={isMoving}
        allFolders={folders}
        folderToMove={folderToMove}
      />
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
