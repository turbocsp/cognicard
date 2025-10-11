import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function StudyPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [answeredCards, setAnsweredCards] = useState(new Map());
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const isFetching = useRef(false);

  const fetchStudySession = useCallback(async () => {
    if (!session || !deckId || isFetching.current) return;
    isFetching.current = true;
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
        .order("created_at", { ascending: true });
      if (cardsError) throw cardsError;
      setCards(cardsData);

      const { data: incompleteAttempt, error: incompleteError } = await supabase
        .from("attempts")
        .select("*")
        .eq("deck_id", deckId)
        .eq("user_id", session.user.id)
        .is("completed_at", null)
        .order("attempt_number", { ascending: false })
        .limit(1)
        .single();

      if (incompleteError && incompleteError.code !== "PGRST116")
        throw incompleteError;

      if (incompleteAttempt) {
        setCurrentAttempt(incompleteAttempt);
        const lastCardIndex = cardsData.findIndex(
          (c) => c.id === incompleteAttempt.last_studied_card_id
        );
        const startIndex = lastCardIndex >= 0 ? lastCardIndex : 0;
        setCurrentCardIndex(startIndex);
      } else {
        const { data: lastAttempt, error: lastAttemptError } = await supabase
          .from("attempts")
          .select("attempt_number")
          .eq("deck_id", deckId)
          .eq("user_id", session.user.id)
          .order("attempt_number", { ascending: false })
          .limit(1)
          .single();

        if (lastAttemptError && lastAttemptError.code !== "PGRST116")
          throw lastAttemptError;

        const newAttemptNumber = (lastAttempt?.attempt_number || 0) + 1;

        const { data: newAttempt, error: newAttemptError } = await supabase
          .from("attempts")
          .insert({
            deck_id: deckId,
            user_id: session.user.id,
            attempt_number: newAttemptNumber,
          })
          .select()
          .single();
        if (newAttemptError) throw newAttemptError;

        setCurrentAttempt(newAttempt);
        setCurrentCardIndex(0);
      }
    } catch (error) {
      toast.error("Erro ao carregar sessão de estudo: " + error.message);
      navigate(`/deck/${deckId}`);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [deckId, session, navigate]);

  useEffect(() => {
    fetchStudySession();
  }, [fetchStudySession]);

  useEffect(() => {
    const saveProgress = () => {
      if (
        currentAttempt &&
        cards.length > 0 &&
        currentCardIndex < cards.length
      ) {
        const lastStudiedCardId = cards[currentCardIndex]?.id;
        if (lastStudiedCardId && !currentAttempt.completed_at) {
          supabase
            .from("attempts")
            .update({ last_studied_card_id: lastStudiedCardId })
            .eq("id", currentAttempt.id)
            .then(({ error }) => {
              if (error) {
                console.error(
                  "Falha ao salvar o progresso na saída:",
                  error.message
                );
              }
            });
        }
      }
    };

    window.addEventListener("beforeunload", saveProgress);
    return () => {
      window.removeEventListener("beforeunload", saveProgress);
      saveProgress();
    };
  }, [currentAttempt, currentCardIndex, cards]);

  const handleNavigation = (direction) => {
    setIsAnswerVisible(false);
    setCurrentCardIndex((prev) => {
      const newIndex = prev + direction;
      if (newIndex >= 0 && newIndex < cards.length) {
        return newIndex;
      }
      return prev;
    });
  };

  const handleAnswer = async (userChoseCorrect) => {
    const card = cards[currentCardIndex];
    if (!card || answeredCards.has(card.id) || !currentAttempt) {
      setIsAnswerVisible(true);
      return;
    }

    // Correctly determine if the answer was right
    const isCorrectAnswerInCard = card.back_content
      .toLowerCase()
      .startsWith("certo.");
    const wasCorrect = userChoseCorrect === isCorrectAnswerInCard;

    const newAnsweredCards = new Map(answeredCards);
    newAnsweredCards.set(card.id, wasCorrect);
    setAnsweredCards(newAnsweredCards);

    const { error: logError } = await supabase.from("study_log").insert({
      card_id: card.id,
      attempt_id: currentAttempt.id,
      user_id: session.user.id,
      was_correct: wasCorrect,
    });

    if (logError) {
      toast.error("Erro ao registrar resposta no log.");
      return;
    }

    const updates = {
      correct_count: currentAttempt.correct_count + (wasCorrect ? 1 : 0),
      incorrect_count: currentAttempt.incorrect_count + (wasCorrect ? 0 : 1),
    };

    const { data, error: attemptError } = await supabase
      .from("attempts")
      .update(updates)
      .eq("id", currentAttempt.id)
      .select()
      .single();

    if (attemptError) {
      toast.error("Erro ao atualizar o resumo da tentativa.");
    } else {
      setCurrentAttempt(data);
    }
    setIsAnswerVisible(true);
  };

  const handleContinue = async () => {
    const totalAnswered =
      (currentAttempt?.correct_count || 0) +
      (currentAttempt?.incorrect_count || 0);

    if (totalAnswered === cards.length) {
      const { error } = await supabase
        .from("attempts")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", currentAttempt.id);

      if (error) {
        toast.error("Erro ao finalizar a tentativa.");
      } else {
        toast.success("Parabéns! Você concluiu este baralho!");
        navigate(`/deck/${deckId}`);
      }
      return;
    }

    const nextUnansweredIndex = cards.findIndex(
      (card, index) => index > currentCardIndex && !answeredCards.has(card.id)
    );

    if (nextUnansweredIndex !== -1) {
      setIsAnswerVisible(false);
      setCurrentCardIndex(nextUnansweredIndex);
    } else {
      const firstUnanswered = cards.findIndex(
        (card) => !answeredCards.has(card.id)
      );
      if (firstUnanswered !== -1) {
        setIsAnswerVisible(false);
        setCurrentCardIndex(firstUnanswered);
      } else {
        toast.success("Todos os cartões foram respondidos!");
        navigate(`/deck/${deckId}`);
      }
    }
  };

  if (loading || !currentAttempt) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
        Carregando...
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4">
        <h2 className="text-2xl font-bold mb-4">Baralho Vazio</h2>
        <p>Este baralho ainda não possui cartões para estudar.</p>
        <Link
          to={`/deck/${deckId}`}
          className="mt-4 text-blue-500 dark:text-blue-400 hover:underline"
        >
          &larr; Voltar para o baralho
        </Link>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center p-4 sm:p-8 pb-32">
      <div className="w-full max-w-2xl">
        <div className="w-full mb-4">
          <Link
            to={`/deck/${deckId}`}
            className="text-sm text-blue-500 dark:text-blue-400 hover:underline"
          >
            &larr; Sair da Sessão
          </Link>
        </div>

        <div className="flex justify-between items-center w-full mb-6 text-sm sm:text-base">
          <span className="font-semibold">
            Tentativa: {String(currentAttempt.attempt_number).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigation(-1)}
              disabled={currentCardIndex === 0}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md font-semibold disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="font-semibold">
              {currentCardIndex + 1} / {cards.length}
            </span>
            <button
              onClick={() => handleNavigation(1)}
              disabled={currentCardIndex === cards.length - 1}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md font-semibold disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
          <span className="font-semibold">
            Progresso:{" "}
            <span className="text-green-500">
              {currentAttempt.correct_count}
            </span>{" "}
            /{" "}
            <span className="text-red-500">
              {currentAttempt.incorrect_count}
            </span>{" "}
            / {cards.length}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 space-y-4 w-full mb-4">
          <h2 className="text-lg font-semibold mb-2 text-center">
            {deck?.name}
          </h2>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-center py-6 min-h-[100px] flex items-center justify-center">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentCard.front_content}
            </ReactMarkdown>
          </div>

          {isAnswerVisible && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p
                className={`text-center font-bold text-lg mb-4 ${
                  answeredCards.get(currentCard.id)
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {answeredCards.get(currentCard.id)
                  ? "Você Acertou!"
                  : "Você Errou!"}
              </p>
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentCard.back_content}
                </ReactMarkdown>
              </div>
              <div className="mt-4 space-y-2">
                {currentCard.theory_notes && (
                  <details className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                    <summary className="font-semibold cursor-pointer">
                      Teoria
                    </summary>
                    <div className="mt-2 text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentCard.theory_notes}
                      </ReactMarkdown>
                    </div>
                  </details>
                )}
                {currentCard.source_references &&
                  currentCard.source_references.length > 0 && (
                    <details className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                      <summary className="font-semibold cursor-pointer">
                        Fontes
                      </summary>
                      <ul className="mt-2 list-disc list-inside text-sm">
                        {currentCard.source_references.map((source, index) => (
                          <li key={index}>{source}</li>
                        ))}
                      </ul>
                    </details>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 w-full p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto">
          {isAnswerVisible ? (
            <button
              onClick={handleContinue}
              className="w-full p-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Continuar
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAnswer(true)}
                className="p-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Certo
              </button>
              <button
                onClick={() => handleAnswer(false)}
                className="p-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Errado
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default StudyPage;
