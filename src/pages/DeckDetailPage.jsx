// src/pages/DeckDetailPage.jsx
import { useState, useEffect, useCallback, useMemo } from "react"; // <<< useEffect e useCallback removidos da busca
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";
import { CardEditModal } from "@/components/CardEditModal.jsx";
import { ConfirmationModal } from "@/components/ConfirmationModal.jsx";
import { MarkdownGuideModal } from "@/components/MarkdownGuideModal.jsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// <<< 1. Importar os hooks do TanStack Query >>>
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// (Serviços não são mais estritamente necessários aqui, mas podemos mantê-los se preferir)
// Vamos chamar o supabase diretamente ou os serviços, se eles existirem (como no deckService)
import deckService from "../services/deckService";

function DeckDetailPage() {
  const { deckId } = useParams();
  const { session } = useAuth();
  const userId = session?.user?.id;

  // <<< 2. Obter o Query Client >>>
  const queryClient = useQueryClient();

  // --- Estados de UI (não são dados do servidor) ---
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    title: "",
    front_content: "",
    back_content: "",
    theory_notes: "",
    source_references: "",
    tags: "",
  });
  const [cardToDelete, setCardToDelete] = useState(null);
  const [cardToEdit, setCardToEdit] = useState(null);

  // --- 3. Remover estados de dados manuais ---
  // [REMOVIDO] const [deck, setDeck] = useState(null);
  // [REMOVIDO] const [cards, setCards] = useState([]);
  // [REMOVIDO] const [cardStats, setCardStats] = useState({});
  // [REMOVIDO] const [loading, setLoading] = useState(true);
  // [REMOVIDO] const [isCreatingCard, setIsCreatingCard] = useState(false);
  // [REMOVIDO] const [isDeletingCard, setIsDeletingCard] = useState(false);
  // [REMOVIDO] const [isSavingCard, setIsSavingCard] = useState(false);

  // [REMOVIDO] const fetchDeckData = useCallback(...);
  // [REMOVIDO] useEffect(() => { fetchDeckData(); }, [fetchDeckData]);

  // --- 4. Usar useQuery para buscar dados ---

  // Query para os detalhes do baralho
  const { data: deck, isLoading: isLoadingDeck } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => deckService.getDeck(deckId), //
    enabled: !!deckId,
  });

  // Query para a lista de cartões
  const { data: cards = [], isLoading: isLoadingCards } = useQuery({
    queryKey: ["cards", deckId],
    queryFn: () => deckService.getDeckCards(deckId), //
    enabled: !!deckId,
  });

  // Query para as estatísticas dos cartões
  const { data: statsData = [], isLoading: isLoadingStats } = useQuery({
    queryKey: ["cardStats", deckId, userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_card_statistics", {
        //
        p_deck_id: deckId,
        p_user_id: userId,
      });
      if (error) {
        console.error("Stats Error:", error);
        toast.error("Erro ao carregar estatísticas dos cartões.");
        throw error;
      }
      return data || [];
    },
    enabled: !!deckId && !!userId,
  });

  // Estado de loading combinado
  const loading = isLoadingDeck || isLoadingCards || isLoadingStats;

  // Derivar o statsMap dos dados carregados (usando useMemo)
  const cardStats = useMemo(() => {
    return (statsData || []).reduce((acc, stat) => {
      acc[stat.card_id] = stat;
      return acc;
    }, {});
  }, [statsData]);

  // --- 5. Helper para invalidar caches ---
  const invalidateDeckCache = () => {
    // Quando um cartão é alterado, buscamos novamente a lista de cartões E as estatísticas
    queryClient.invalidateQueries({ queryKey: ["cards", deckId] });
    queryClient.invalidateQueries({ queryKey: ["cardStats", deckId, userId] });
  };

  // --- 6. Usar useMutation para CUD (Create, Update, Delete) ---

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCard((prev) => ({ ...prev, [name]: value }));
  };

  // Mutação para CRIAR cartão
  const createCardMutation = useMutation({
    mutationFn: (cardData) => {
      return supabase.from("cards").insert(cardData);
    },
    onSuccess: () => {
      toast.success("Cartão adicionado com sucesso!");
      setNewCard({
        // Limpar formulário
        title: "",
        front_content: "",
        back_content: "",
        theory_notes: "",
        source_references: "",
        tags: "",
      });
      invalidateDeckCache(); // Atualizar UI
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateCard = async (e) => {
    e.preventDefault();
    if (!newCard.front_content.trim() || !newCard.back_content.trim()) return;

    const cardData = {
      deck_id: deckId,
      user_id: session.user.id,
      title: newCard.title.trim() || null,
      front_content: newCard.front_content,
      back_content: newCard.back_content,
      theory_notes: newCard.theory_notes || null,
      source_references: newCard.source_references
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      tags: newCard.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    createCardMutation.mutate(cardData);
  };

  // Mutação para EDITAR cartão
  const saveCardMutation = useMutation({
    mutationFn: (updatedCard) => {
      return supabase
        .from("cards")
        .update({
          title: updatedCard.title,
          front_content: updatedCard.front_content,
          back_content: updatedCard.back_content,
          theory_notes: updatedCard.theory_notes,
          source_references: updatedCard.source_references,
          tags: updatedCard.tags,
        })
        .eq("id", updatedCard.id);
    },
    onSuccess: () => {
      toast.success("Cartão atualizado com sucesso!");
      invalidateDeckCache();
      setCardToEdit(null); // Fechar modal
    },
    onError: (error) => {
      toast.error(`Erro ao salvar alterações: ${error.message}`);
    },
  });

  // Mutação para EXCLUIR cartão
  const deleteCardMutation = useMutation({
    mutationFn: (cardId) => {
      return supabase.from("cards").delete().eq("id", cardId);
    },
    onSuccess: () => {
      toast.success("Cartão excluído com sucesso.");
      invalidateDeckCache();
      setCardToDelete(null); // Fechar modal
    },
    onError: (error) => {
      toast.error(`Erro ao excluir cartão: ${error.message}`);
    },
  });

  const handleDeleteCard = async () => {
    if (!cardToDelete) return;
    deleteCardMutation.mutate(cardToDelete.id);
  };

  // --- 7. Renderização (usando os novos estados) ---

  if (loading)
    return (
      <div className="p-8 text-center dark:text-white">
        Carregando baralho...
      </div>
    );
  if (!deck)
    return (
      <div className="p-8 text-center dark:text-white">
        Baralho não encontrado.
      </div>
    );

  // O componente agora usa 'deck' e 'cards' diretamente dos hooks useQuery
  // E passa os estados 'isPending' das mutações para os modais e formulários

  return (
    <div className="min-h-screen pb-12">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold">{deck.name}</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/deck/${deckId}/study`}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition text-center"
            >
              Estudar Baralho
            </Link>
            <Link
              to={`/deck/${deckId}/import`}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition text-center"
            >
              Importar Cartões
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow sticky top-24">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Adicionar Novo Cartão</h2>
              <button
                onClick={() => setIsGuideOpen(true)}
                className="text-sm text-blue-500 dark:text-blue-400 hover:underline"
              >
                Guia de Formatação
              </button>
            </div>
            {/* <<< 8. Usar createCardMutation.isPending >>> */}
            <form onSubmit={handleCreateCard} className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium mb-1"
                >
                  Título (Opcional)
                </label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  value={newCard.title}
                  onChange={handleInputChange}
                  disabled={createCardMutation.isPending} // <<< Alterado
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="front_content"
                  className="block text-sm font-medium mb-1"
                >
                  Frente (Pergunta)
                </label>
                <textarea
                  name="front_content"
                  id="front_content"
                  value={newCard.front_content}
                  onChange={handleInputChange}
                  rows={3}
                  disabled={createCardMutation.isPending} // <<< Alterado
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="back_content"
                  className="block text-sm font-medium mb-1"
                >
                  Verso (Resposta)
                </label>
                <textarea
                  name="back_content"
                  id="back_content"
                  value={newCard.back_content}
                  onChange={handleInputChange}
                  rows={3}
                  disabled={createCardMutation.isPending} // <<< Alterado
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="theory_notes"
                  className="block text-sm font-medium mb-1"
                >
                  Teoria (Opcional)
                </label>
                <textarea
                  name="theory_notes"
                  id="theory_notes"
                  value={newCard.theory_notes}
                  onChange={handleInputChange}
                  rows={2}
                  disabled={createCardMutation.isPending} // <<< Alterado
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="source_references"
                  className="block text-sm font-medium mb-1"
                >
                  Fontes (separadas por vírgula)
                </label>
                <input
                  type="text"
                  name="source_references"
                  id="source_references"
                  value={newCard.source_references}
                  onChange={handleInputChange}
                  disabled={createCardMutation.isPending} // <<< Alterado
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="tags"
                  className="block text-sm font-medium mb-1"
                >
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  name="tags"
                  id="tags"
                  value={newCard.tags}
                  onChange={handleInputChange}
                  disabled={createCardMutation.isPending} // <<< Alterado
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={createCardMutation.isPending} // <<< Alterado
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-75 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {createCardMutation.isPending
                  ? "A adicionar..."
                  : "Adicionar Cartão"}
              </button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">
            Cartões no Baralho ({cards.length})
          </h2>
          <div className="space-y-4">
            {cards.length > 0 ? (
              cards.map((card) => (
                <div
                  key={card.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow relative group"
                >
                  {card.title && (
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 truncate">
                      {card.title}
                    </h3>
                  )}
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setCardToEdit(card)}
                      title="Editar"
                      // <<< 9. Usar estados 'isPending' das mutações >>>
                      disabled={
                        deleteCardMutation.isPending ||
                        saveCardMutation.isPending
                      }
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full disabled:opacity-25"
                    >
                      <svg
                        className="w-5 h-5 text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCardToDelete(card)}
                      title="Excluir"
                      // <<< 9. Usar estados 'isPending' das mutações >>>
                      disabled={
                        deleteCardMutation.isPending ||
                        saveCardMutation.isPending
                      }
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full disabled:opacity-25"
                    >
                      <svg
                        className="w-5 h-5 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  <div
                    className={`prose prose-sm dark:prose-invert max-w-none pr-16 ${
                      card.title ? "pt-1" : ""
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {card.front_content}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {card.back_content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {/* Usa 'cardStats' (do useMemo) */}
                  {(cardStats[card.id]?.total_views > 0 ||
                    (card.tags && card.tags.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                      {cardStats[card.id]?.total_views > 0 && (
                        <div className="flex items-center gap-4 text-xs">
                          <span
                            title="Taxa de acerto"
                            className={
                              cardStats[card.id].accuracy >= 75
                                ? "text-green-500 font-semibold"
                                : cardStats[card.id].accuracy >= 50
                                ? "text-yellow-500 font-semibold"
                                : "text-red-500 font-semibold"
                            }
                          >
                            ✅ {cardStats[card.id].accuracy}%
                          </span>
                          <span
                            title="Visto x vezes"
                            className="text-gray-500 dark:text-gray-400"
                          >
                            👀 {cardStats[card.id].total_views}x
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(card.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                Este baralho ainda não tem cartões.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* <<< 10. Passar os estados 'isPending' para os modais >>> */}
      <ConfirmationModal
        isOpen={!!cardToDelete}
        onClose={() => setCardToDelete(null)}
        onConfirm={handleDeleteCard}
        isConfirming={deleteCardMutation.isPending} // <<< Alterado
        title="Confirmar Exclusão de Cartão"
        message="Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita."
      />
      <CardEditModal
        isOpen={!!cardToEdit}
        onClose={() => setCardToEdit(null)}
        onSave={saveCardMutation.mutate} // <<< Passa a função 'mutate' diretamente
        isSaving={saveCardMutation.isPending} // <<< Alterado
        card={cardToEdit}
      />
      <MarkdownGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}

export default DeckDetailPage;
