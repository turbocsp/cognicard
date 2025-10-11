import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";
import { CardEditModal } from "@/components/CardEditModal.jsx";
import { ConfirmationModal } from "@/components/ConfirmationModal.jsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownGuideModal } from "@/components/MarkdownGuideModal";

function DeckDetailPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newCard, setNewCard] = useState({
    front_content: "",
    back_content: "",
    theory_notes: "",
    source_references: "",
    tags: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardToDelete, setCardToDelete] = useState(null);
  const [cardToEdit, setCardToEdit] = useState(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const fetchDeckData = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    try {
      const { data: deckData, error: deckError } = await supabase
        .from("decks")
        .select("name")
        .eq("id", deckId)
        .single();
      if (deckError) throw deckError;
      setDeck(deckData);

      const { data: cardsData, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", deckId)
        .order("created_at");
      if (cardsError) throw cardsError;
      setCards(cardsData || []);
    } catch (error) {
      toast.error("Erro ao carregar dados do baralho: " + error.message);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [deckId, navigate]);

  useEffect(() => {
    fetchDeckData();
  }, [fetchDeckData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCard((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateCard = async (e) => {
    e.preventDefault();
    if (
      !newCard.front_content.trim() ||
      !newCard.back_content.trim() ||
      !deckId ||
      !session
    )
      return;
    setIsSubmitting(true);

    const { error } = await supabase.from("cards").insert({
      deck_id: deckId,
      user_id: session.user.id,
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
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cartão adicionado com sucesso!");
      setNewCard({
        front_content: "",
        back_content: "",
        theory_notes: "",
        source_references: "",
        tags: "",
      });
      fetchDeckData(); // Refresh cards list
    }
    setIsSubmitting(false);
  };

  const handleDeleteCard = async () => {
    if (!cardToDelete) return;
    const { error } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardToDelete.id);
    if (error) {
      toast.error(`Erro ao excluir cartão: ${error.message}`);
    } else {
      toast.success("Cartão excluído com sucesso.");
      fetchDeckData();
    }
    setCardToDelete(null);
  };

  const handleSaveEdit = async (updatedCard) => {
    const { error } = await supabase
      .from("cards")
      .update({
        front_content: updatedCard.front_content,
        back_content: updatedCard.back_content,
        theory_notes: updatedCard.theory_notes,
        source_references: updatedCard.source_references,
        tags: updatedCard.tags,
      })
      .eq("id", updatedCard.id);

    if (error) {
      toast.error(`Erro ao salvar alterações: ${error.message}`);
    } else {
      toast.success("Cartão atualizado com sucesso!");
      fetchDeckData();
    }
    setCardToEdit(null);
  };

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <Link
            to="/dashboard"
            className="text-blue-500 dark:text-blue-400 hover:underline mb-2 block"
          >
            &larr; Voltar ao Painel
          </Link>
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
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow sticky top-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Adicionar Novo Cartão</h2>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="text-sm text-blue-500 dark:text-blue-400 hover:underline font-medium"
                >
                  Guia
                </button>
              </div>
              <form onSubmit={handleCreateCard} className="space-y-4">
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
                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-gray-400"
                >
                  {isSubmitting ? "Adicionando..." : "Adicionar Cartão"}
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
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setCardToEdit(card)}
                        title="Editar"
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
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
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
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
                    <div className="prose prose-sm dark:prose-invert max-w-none border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 pr-16">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {card.front_content}
                      </ReactMarkdown>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 mb-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {card.back_content}
                      </ReactMarkdown>
                    </div>
                    {card.tags && card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        {card.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
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
      </div>

      <ConfirmationModal
        isOpen={!!cardToDelete}
        onClose={() => setCardToDelete(null)}
        onConfirm={handleDeleteCard}
        title="Confirmar Exclusão de Cartão"
        message="Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita."
      />

      <CardEditModal
        isOpen={!!cardToEdit}
        onClose={() => setCardToEdit(null)}
        onSave={handleSaveEdit}
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
