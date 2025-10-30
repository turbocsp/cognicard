import { useState, useEffect, useCallback } from "react";
// import { supabase } from "@/supabaseClient"; // Não precisa mais importar supabase diretamente aqui
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

// <<< Importar os serviços >>>
import deckService from "@/services/deckService";
import folderService from "@/services/folderService";
import { supabase } from "@/supabaseClient"; // Manter import para RPCs

export function DashboardPage() {
  const { session } = useAuth();

  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState([]);

  const [newItemName, setNewItemName] = useState("");
  const [newParentFolderId, setNewParentFolderId] = useState("root");
  const [isSubmitting, setIsSubmitting] = useState(false); // Pode ser usado para granularidade depois

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

  // <<< Atualizado para usar serviços >>>
  const fetchDashboardData = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
        const [deckData, folderData, streakResult, activityResult] = await Promise.all([
            deckService.getUserDecks(session.user.id), // Usa serviço
            folderService.getUserFolders(session.user.id), // Usa serviço
            supabase // RPCs ainda usam supabase diretamente
                .rpc("get_study_streak", { p_user_id: session.user.id })
                .single(),
            supabase // RPCs ainda usam supabase diretamente
                .rpc("get_study_activity", {
                    p_user_id: session.user.id,
                    p_year: currentYear,
                })
        ]);

        setDecks(deckData);
        setFolders(folderData);

        // Tratamento de erros/resultados de RPCs (sem alterações)
        if (streakResult.error) toast.error(`Streak Error: ${streakResult.error.message}`);
        else if (streakResult.data) setStreakData(streakResult.data);

        if (activityResult.error) toast.error(`Activity Error: ${activityResult.error.message}`);
        else setActivityData(activityResult.data || []);

    } catch (error) {
        // Erros dos serviços agora são capturados aqui
        toast.error(error.message || "Erro ao carregar dados do painel.");
        setDecks([]); // Garante estado limpo em caso de erro
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
    // ... (código existente para buildTree)
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


  // <<< Atualizado para usar serviços >>>
  const handleCreate = async (type, e) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      toast.error("O nome não pode estar vazio.");
      return;
    }
    const parentId = newParentFolderId === "root" ? null : newParentFolderId;

    // Lógica de verificação de duplicados (sem alterações)
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

    setIsSubmitting(true);
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
        fetchDashboardData(); // Recarrega tudo
    } catch (error) {
        toast.error(error.message || `Erro ao criar ${type}.`);
    } finally {
        setIsSubmitting(false);
    }
  };

  // <<< Atualizado para usar serviços >>>
  const handleRename = async (newName) => {
    const trimmedNewName = newName.trim();
    if (!editingItemId || !trimmedNewName) {
        setEditingItemId(null); // Cancela edição se nome vazio
        return;
    }
    const item =
      folders.find((f) => f.id === editingItemId) ||
      decks.find((d) => d.id === editingItemId);

    if (!item || item.name === trimmedNewName) { // Não faz nada se nome igual
        setEditingItemId(null);
        return;
    }

    const type = "parent_folder_id" in item ? "folder" : "deck";
    const parentId = type === "folder" ? item.parent_folder_id : item.folder_id;

    // Lógica de verificação de duplicados (sem alterações)
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
      setEditingItemId(null); // Mantém edição aberta talvez? Ou cancela? Cancelei.
      return;
    }

    // setIsSubmitting(true); // Poderia adicionar granularidade aqui
    try {
        if (type === 'deck') {
            await deckService.renameDeck(editingItemId, trimmedNewName);
        } else {
            await folderService.renameFolder(editingItemId, trimmedNewName);
        }
        toast.success("Renomeado com sucesso!");
        fetchDashboardData(); // Recarrega
    } catch (error) {
        toast.error(error.message || "Erro ao renomear.");
    } finally {
        setEditingItemId(null);
        setContextMenu(null);
        // setIsSubmitting(false);
    }
  };

  // <<< Atualizado para usar serviços >>>
  const handleMoveDeck = async (newFolderId) => {
    if (!deckToMove) return;

    // Lógica de verificação de duplicados (sem alterações)
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

     // setIsSubmitting(true);
    try {
        await deckService.moveDeck(deckToMove.id, newFolderId);
        toast.success(`Baralho movido com sucesso!`);
        fetchDashboardData(); // Recarrega
    } catch(error) {
        toast.error(error.message || "Erro ao mover o baralho.");
    } finally {
        setDeckToMove(null);
         // setIsSubmitting(false);
    }
  };

  // <<< Atualizado para usar serviços >>>
  const handleMoveFolder = async (newParentFolderId) => {
    if (!folderToMove) return;

    // Lógica de verificação de duplicados (sem alterações)
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

     // setIsSubmitting(true);
    try {
        await folderService.moveFolder(folderToMove.id, newParentFolderId);
        toast.success(`Pasta movida com sucesso!`);
        fetchDashboardData(); // Recarrega
    } catch(error) {
         toast.error(error.message || "Erro ao mover a pasta.");
    } finally {
        setFolderToMove(null);
        // setIsSubmitting(false);
    }
  };

  // <<< Atualizado para usar serviços >>>
  const handleDelete = async () => {
    if (!itemToDelete) return;
    const { id, type, name } = itemToDelete;

     // setIsSubmitting(true);
    try {
        if (type === 'deck') {
            await deckService.deleteDeck(id);
        } else {
            await folderService.deleteFolder(id);
        }
         toast.success(`"${name}" foi excluído(a).`);
         fetchDashboardData(); // Recarrega
    } catch (error) {
         toast.error(error.message || "Erro ao excluir.");
    } finally {
        setItemToDelete(null);
        // setIsSubmitting(false);
    }
  };

  // Funções toggleFolder, getContextMenuItems, renderFolderOptions, handleTouchStart, handleTouchEnd (sem alterações)
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


  // Componente FileSystemNode (sem alterações na lógica principal, apenas chamadas indiretas)
  const FileSystemNode = ({ node, depth }) => {
    // ... (código existente)
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
                onSave={handleRename} // Chama a função refatorada
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

    // --- CORREÇÃO DE ALINHAMENTO APLICADA ABAIXO ---
    return (
      <div
        className="flex items-center p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50"
        // Aplica indentação base apenas se depth > 0
        style={{
          paddingLeft: depth > 0 ? `${depth * 20 + 4 + 16 + 8}px` : "4px",
        }}
        onContextMenu={handleContextMenu}
        onTouchStart={(e) => handleTouchStart(e, node)}
        onTouchEnd={handleTouchEnd}
      >
        <span className="mr-2 text-blue-400">🃏</span>
        {isEditing ? (
          <InlineEdit
            initialValue={node.name}
            onSave={handleRename} // Chama a função refatorada
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
  }; // Fim do FileSystemNode


  // Renderização principal (JSX sem alterações significativas, apenas as chamadas de função nos handlers)
  return (
    <div className="min-h-screen pb-8" onClick={() => setContextMenu(null)}>
      {/* ... (JSX da página, incluindo ActivityCalendar, Formulário, FileSystemNode, Modais) ... */}
       <main className="space-y-8">
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
          {/* ... (código do resumo de atividade e calendário) ... */}
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
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow min-h-[400px]">
            <GlobalSearch />
            <div className="mt-4">
              {loading ? (
                <p>Carregando...</p>
              ) : treeData.length === 0 ? (
                 <p className="text-gray-500 dark:text-gray-400 text-center mt-8">Crie sua primeira pasta ou baralho no painel ao lado!</p>
              ) : (
                treeData.map((node) => (
                  <FileSystemNode key={node.id} node={node} depth={0} />
                ))
              )}
            </div>
          </div>
          <div
            className="lg:col-span-1 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Criar Novo Item</h2>
              {/* ... (Formulário de criação chamando handleCreate) ... */}
               <div>
                <label className="block text-sm font-medium mb-1">
                  Nome do Item
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Ex: Biologia Celular"
                  className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">
                  Localização
                </label>
                <select
                  value={newParentFolderId}
                  onChange={(e) => setNewParentFolderId(e.target.value)}
                  className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="root">Raiz</option>
                  {renderFolderOptions(treeData)}
                </select>
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  onClick={(e) => handleCreate("deck", e)}
                  disabled={isSubmitting || !newItemName}
                  className="flex-1 bg-blue-800 hover:bg-blue-900 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-md disabled:opacity-90 transition-colors"
                >
                  Criar Baralho
                </button>
                <button
                  onClick={(e) => handleCreate("folder", e)}
                  disabled={isSubmitting || !newItemName}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-90 transition-colors"
                >
                  Criar Pasta
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modais e ContextMenu (sem alterações, apenas chamam os handlers refatorados) */}
      {/* ... (JSX existente para ContextMenu, ConfirmationModal, MoveDeckModal, MoveFolderModal, DailySummaryModal) ... */}
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
        onConfirm={handleDelete} // Chama a função refatorada
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
        onConfirm={handleMoveDeck} // Chama a função refatorada
        folders={folders}
        currentFolderId={deckToMove?.folder_id || null}
        deckName={deckToMove?.name || ""}
      />
      <MoveFolderModal
        isOpen={!!folderToMove}
        onClose={() => setFolderToMove(null)}
        onConfirm={handleMoveFolder} // Chama a função refatorada
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
