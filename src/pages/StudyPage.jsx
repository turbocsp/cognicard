// src/pages/StudyPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import attemptService from "../services/attemptService";
import deckService from "../services/deckService";
import { supabase } from "@/supabaseClient";
import { toast } from "react-hot-toast";

// Função shuffleDeck
const shuffleDeck = (cards) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Função formatSourcesWithLinks
const formatSourcesWithLinks = (sources) => {
  if (!sources) return [];

  const formatSingleSource = (source) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = source.match(urlRegex);

    if (matches) {
      let formattedSource = source;
      matches.forEach((url) => {
        formattedSource = formattedSource.replace(
          url,
          `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${url}</a>`
        );
      });
      return formattedSource;
    }
    return source;
  };

  if (Array.isArray(sources)) {
    return sources.map(formatSingleSource);
  } else {
    return [formatSingleSource(sources)];
  }
};

const StudyPage = () => {
  const { deckId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();

  // Estados - TODOS PRIMEIRO
  const [attempt, setAttempt] = useState(null);
  const [cardsInCurrentView, setCardsInCurrentView] = useState([]);
  const [allCardsMap, setAllCardsMap] = useState(new Map());
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [deck, setDeck] = useState(null);
  const [userChoice, setUserChoice] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [answeredCards, setAnsweredCards] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // TODOS OS HOOKS useMemo ANTES DOS RETURNS
  const currentCard = useMemo(() => {
    if (cardsInCurrentView && currentCardIndex < cardsInCurrentView.length) {
      return cardsInCurrentView[currentCardIndex];
    }
    return null;
  }, [cardsInCurrentView, currentCardIndex]);

  const totalCardsInDeckAttempt = attempt?.card_order?.length || 0;
  const studiedCount = answeredCards.size;
  const progressPercent =
    totalCardsInDeckAttempt > 0
      ? (studiedCount / totalCardsInDeckAttempt) * 100
      : 0;

  const currentCardOriginalIndex = useMemo(() => {
    if (attempt?.card_order && currentCard) {
      return attempt.card_order.findIndex((id) => id === currentCard.id);
    }
    return -1;
  }, [attempt, currentCard]);

  const displayCardNumber =
    currentCardOriginalIndex !== -1 ? currentCardOriginalIndex + 1 : "?";

  const formattedSources = currentCard?.source_references
    ? formatSourcesWithLinks(currentCard.source_references)
    : [];

  const isCardAnswered = () => {
    if (!currentCard) return false;
    return answeredCards.has(currentCard.id);
  };

  // useEffect ANTES DOS RETURNS
  useEffect(() => {
    if (!deckId || !session?.user?.id) {
      setError("Deck não selecionado ou usuário não autenticado.");
      setIsLoading(false);
      return;
    }
    loadStudySession();
  }, [deckId, session]);

  const loadStudySession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Buscar informações do deck
      const deckData = await deckService.getDeck(deckId);
      setDeck(deckData);

      // Buscar cartas do baralho
      const deckCards = await deckService.getDeckCards(deckId);
      setAllCardsMap(new Map(deckCards.map((card) => [card.id, card])));

      if (deckCards.length === 0) {
        throw new Error("Nenhuma carta encontrada neste baralho");
      }

      // Buscar tentativa ativa
      const activeAttempt = await attemptService.getActiveAttempt(
        deckId,
        session.user.id
      );

      if (activeAttempt && !activeAttempt.completed) {
        await continueAttempt(activeAttempt, deckCards);
      } else {
        await createNewAttempt(deckCards);
      }
    } catch (err) {
      console.error("Erro detalhado:", err);
      setError(`Erro ao carregar sessão: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const continueAttempt = async (existingAttempt, allDeckCards) => {
    setAttempt(existingAttempt);
    const cardMap = new Map(allDeckCards.map((card) => [card.id, card]));

    // Ordena conforme a tentativa
    const orderedCards = existingAttempt.card_order
      .map((cardId) => cardMap.get(cardId))
      .filter((card) => card);

    const studiedSet = new Set(existingAttempt.studied_cards || []);
    const remainingCards = orderedCards.filter(
      (card) => !studiedSet.has(card.id)
    );

    setCardsInCurrentView(remainingCards);

    let startIndex = 0;
    if (remainingCards.length > 0 && existingAttempt.last_studied_card_id) {
      const lastStudiedOriginalIndex = orderedCards.findIndex(
        (card) => card.id === existingAttempt.last_studied_card_id
      );

      if (
        lastStudiedOriginalIndex !== -1 &&
        lastStudiedOriginalIndex < orderedCards.length - 1
      ) {
        const nextCardId = orderedCards[lastStudiedOriginalIndex + 1].id;
        const nextIndexInRemaining = remainingCards.findIndex(
          (card) => card.id === nextCardId
        );
        if (nextIndexInRemaining !== -1) {
          startIndex = nextIndexInRemaining;
        }
      }
    }

    setCurrentCardIndex(startIndex);
    setShowAnswer(false);
    setUserChoice(null);
    setAnsweredCards(studiedSet);
  };

  const createNewAttempt = async (allDeckCards) => {
    const shuffledCards = shuffleDeck([...allDeckCards]);
    const cardOrder = shuffledCards.map((card) => card.id);

    const userAttempts = await attemptService.getUserAttempts(
      session.user.id,
      deckId
    );
    const attemptNumber = userAttempts.length + 1;

    const newAttempt = await attemptService.createAttempt({
      deck_id: deckId,
      user_id: session.user.id,
      attempt_number: attemptNumber,
      card_order: cardOrder,
      studied_cards: [],
      correct_count: 0,
      incorrect_count: 0,
      completed: false,
      created_at: new Date().toISOString(),
      last_studied_card_id: null,
    });

    setAttempt(newAttempt);
    setCardsInCurrentView(shuffledCards);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setUserChoice(null);
    setAnsweredCards(new Set());
  };

  const addStudyLog = async (cardId, wasCorrect) => {
    if (!attempt || !session?.user?.id) return;
    try {
      await supabase.from("study_log").insert({
        user_id: session.user.id,
        card_id: cardId,
        attempt_id: attempt.id,
        was_correct: wasCorrect,
      });
    } catch (logError) {
      console.error("Erro ao salvar log de estudo:", logError);
    }
  };

  const handleUserChoice = (choice) => {
    if (!currentCard) return;

    if (answeredCards.has(currentCard.id)) return;

    const answerStartsWithCorrect = currentCard.back_content
      .toLowerCase()
      .trim()
      .startsWith("certo");
    const userIsCorrect =
      (choice === "certo" && answerStartsWithCorrect) ||
      (choice === "errado" && !answerStartsWithCorrect);

    setUserChoice(choice);
    setIsCorrect(userIsCorrect);
    setShowAnswer(true);

    addStudyLog(currentCard.id, userIsCorrect);
  };

  const markCardAsStudiedAndContinue = async () => {
    if (!attempt || !currentCard || isProcessing) return;

    setIsProcessing(true);

    if (answeredCards.has(currentCard.id)) {
      goToNextCard();
      setIsProcessing(false);
      return;
    }

    setAnsweredCards((prev) => new Set(prev).add(currentCard.id));

    const updatedStudiedCards = [
      ...(attempt.studied_cards || []),
      currentCard.id,
    ];

    try {
      const updatedCorrectCount = isCorrect
        ? (attempt.correct_count || 0) + 1
        : attempt.correct_count || 0;
      const updatedIncorrectCount = !isCorrect
        ? (attempt.incorrect_count || 0) + 1
        : attempt.incorrect_count || 0;

      const updatedAttempt = await attemptService.updateAttempt(attempt.id, {
        studied_cards: updatedStudiedCards,
        correct_count: updatedCorrectCount,
        incorrect_count: updatedIncorrectCount,
        last_studied_card_id: currentCard.id,
      });

      setAttempt(updatedAttempt);

      if (updatedStudiedCards.length === attempt.card_order.length) {
        await completeStudySession(updatedAttempt);
      } else {
        goToNextCard();
      }
    } catch (err) {
      setAnsweredCards((prev) => {
        const newSet = new Set(prev);
        newSet.delete(currentCard.id);
        return newSet;
      });
      setError("Erro ao salvar progresso");
      console.error("Error marking card as studied:", err);
      toast.error("Erro ao salvar seu progresso. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const completeStudySession = async (attemptData) => {
    try {
      const completedAttempt = await attemptService.completeAttempt(
        attemptData.id
      );
      setAttempt(completedAttempt);
    } catch (err) {
      setError("Erro ao finalizar sessão");
      console.error("Error completing study session:", err);
      toast.error("Erro ao finalizar a sessão de estudo.");
    }
  };

  const restartSession = async () => {
    if (!attempt || isProcessing) return;

    try {
      setIsProcessing(true);
      setError(null);

      // Buscar todas as cartas do deck
      const deckCards = await deckService.getDeckCards(deckId);
      if (deckCards.length === 0) {
        throw new Error(
          "Nenhuma carta encontrada neste baralho para reiniciar"
        );
      }

      // Embaralhar as cartas
      const shuffledCards = shuffleDeck([...deckCards]);
      const cardOrder = shuffledCards.map((card) => card.id);

      // Atualizar a tentativa atual (não criar nova)
      const updatedAttempt = await attemptService.updateAttempt(attempt.id, {
        card_order: cardOrder,
        studied_cards: [],
        correct_count: 0,
        incorrect_count: 0,
        completed: false,
        last_studied_card_id: null,
      });

      // Atualizar os estados locais
      setAttempt(updatedAttempt);
      setCardsInCurrentView(shuffledCards);
      setCurrentCardIndex(0);
      setShowAnswer(false);
      setUserChoice(null);
      setAnsweredCards(new Set());

      toast.success("Tentativa reiniciada com sucesso!");
    } catch (err) {
      setError("Erro ao reiniciar tentativa");
      console.error("Error restarting session:", err);
      toast.error("Não foi possível reiniciar a tentativa.");
    } finally {
      setIsProcessing(false);
    }
  };

  const pauseSession = () => {
    navigate(`/deck/${deckId}`);
  };

  const goToNextCard = () => {
    if (currentCardIndex < cardsInCurrentView.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      setShowAnswer(false);
      setUserChoice(null);
    } else if (
      cardsInCurrentView.length > 0 &&
      currentCardIndex === cardsInCurrentView.length - 1 &&
      !attempt?.completed
    ) {
      // Se estamos na última carta e a sessão não está completa, avisamos.
      toast.info("Você chegou ao final dos cards restantes nesta tentativa.");
    } else if (attempt?.completed) {
      // Se a sessão já está completa e tentou avançar da última, não faz nada ou redireciona
      // Poderia redirecionar para a tela de resultados, mas o estado completed já faz isso.
    }
  };

  const goToPrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1);
      setShowAnswer(false);
      setUserChoice(null);
    }
  };

  // AGORA OS RETURNS CONDICIONAIS
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen dark:text-white">
        Carregando sessão de estudo...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center dark:text-white">
        <div className="text-red-500 mb-4">{error}</div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={loadStudySession}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition"
          >
            Tentar Novamente
          </button>
          <button
            onClick={() => navigate(`/deck/${deckId}`)}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition"
          >
            Voltar ao Baralho
          </button>
        </div>
      </div>
    );
  }

  if (attempt?.completed) {
    const totalQuestions = attempt.correct_count + attempt.incorrect_count;
    const accuracy =
      totalQuestions > 0
        ? Math.round((attempt.correct_count / totalQuestions) * 100)
        : 0;
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 text-center dark:text-white">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md w-full mb-6">
          <h2 className="text-3xl font-bold mb-6">
            🎉 Parabéns! Sessão Concluída!
          </h2>
          <p className="font-semibold text-lg mb-4">
            Tentativa #{attempt.attempt_number}
          </p>
          <div className="space-y-2 text-left">
            <p>✅ Certas: {attempt.correct_count}</p>
            <p>❌ Erradas: {attempt.incorrect_count}</p>
            <p>📊 Total Respondidas: {totalQuestions}</p>
            <p>🎯 Precisão: {accuracy}%</p>
            <p>
              Concluído em:{" "}
              {new Date(attempt.completed_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={restartSession}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition"
          >
            Reiniciar Tentativa
          </button>
          <button
            onClick={() => navigate(`/deck/${deckId}`)}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition"
          >
            Voltar ao Baralho
          </button>
        </div>
      </div>
    );
  }

  if (cardsInCurrentView.length === 0 && !isLoading && !attempt?.completed) {
    // Se não há mais cartas para mostrar NESTA TENTATIVA, mas a tentativa ainda não foi marcada como completa
    // (Isso pode acontecer se o usuário pausar e voltar depois de responder tudo, mas antes do completeStudySession ser chamado)
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 text-center dark:text-white">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md w-full mb-6">
          <h2 className="text-2xl font-bold mb-4">Fim da Tentativa</h2>
          <p className="mb-6">
            Você já estudou todas as cartas disponíveis nesta tentativa.
          </p>
          <p>✅ Certas: {attempt?.correct_count || 0}</p>
          <p>❌ Erradas: {attempt?.incorrect_count || 0}</p>
          <button
            onClick={() => completeStudySession(attempt)} // Adiciona botão para forçar conclusão se necessário
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition"
            disabled={isProcessing}
          >
            {isProcessing ? "Finalizando..." : "Finalizar Sessão"}
          </button>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={restartSession}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition"
            disabled={isProcessing}
          >
            Reiniciar Tentativa
          </button>
          <button
            onClick={() => navigate(`/deck/${deckId}`)}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition"
          >
            Voltar ao Baralho
          </button>
        </div>
      </div>
    );
  }

  // Se não carregou, erro, completo ou vazio, então temos um cartão para mostrar
  const isAnswered = isCardAnswered();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header Compactado */}
      <header className="w-full p-3 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-y-2 text-xs sm:text-sm">
          {/* Lado Esquerdo */}
          <div className="flex items-center gap-3">
            <span
              className="font-semibold truncate max-w-[150px] sm:max-w-[250px]"
              title={deck?.name}
            >
              {deck?.name || "Estudo"}
            </span>
            <span>Tentativa: {attempt?.attempt_number || 1}</span>
            {/* <<< REMOVIDO hidden sm:inline >>> */}
            <span>
              {attempt?.correct_count || 0} ✅ / {attempt?.incorrect_count || 0}{" "}
              ❌ / {totalCardsInDeckAttempt} 🃏
            </span>
          </div>

          {/* Centro: Navegação */}
          <div className="flex items-center gap-2 order-3 sm:order-2 w-full sm:w-auto justify-center">
            <button
              onClick={goToPrevCard}
              disabled={currentCardIndex === 0}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 text-xs"
            >
              Anterior
            </button>
            <span className="font-semibold">
              Card {displayCardNumber} / {totalCardsInDeckAttempt}
            </span>
            <button
              onClick={goToNextCard}
              disabled={currentCardIndex >= cardsInCurrentView.length - 1} // Ajustado para desabilitar no último
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 text-xs"
            >
              Próximo
            </button>
          </div>

          {/* Lado Direito */}
          <div className="flex items-center gap-3 order-2 sm:order-3">
            <div className="w-20 sm:w-28 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
                title={`${Math.round(progressPercent)}% concluído`}
              ></div>
            </div>
            <span>{Math.round(progressPercent)}%</span>
            <button
              onClick={restartSession}
              disabled={isProcessing}
              className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs disabled:opacity-50"
              title="Reiniciar Tentativa"
            >
              🔄
            </button>
            <button
              onClick={pauseSession}
              className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs"
              title="Pausar e Sair"
            >
              ⏸️
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 pb-24">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-2xl text-center">
          {/* <<< Título (Nome do Cartão ou Deck) ATUALIZADO >>> */}
          <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">
            {currentCard?.title || deck?.name || "Estudo"}
          </h2>
          {/* Frente */}
          <div className="mb-6 min-h-[100px] flex items-center justify-center">
            <p className="text-lg">{currentCard?.front_content}</p>
          </div>

          {/* Mensagem se já foi respondida */}
          {isAnswered && !showAnswer && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded-md">
              <p className="text-yellow-800 dark:text-yellow-200">
                Você já respondeu este card. Clique em "Mostrar Resposta" para
                revisar.
              </p>
            </div>
          )}

          {/* Resposta e Feedback */}
          {showAnswer && currentCard && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-4 text-left">
              <p
                className={`font-bold text-lg ${
                  isCorrect
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {isCorrect ? "✅ Você Acertou!" : "❌ Você Errou!"}
              </p>
              <p className="text-base">{currentCard.back_content}</p>

              {/* Teoria com <details> */}
              {currentCard.theory_notes && (
                <details className="bg-gray-100 dark:bg-gray-700 dark:bg-opacity-50 rounded p-2 text-sm">
                  <summary className="cursor-pointer font-semibold list-none">
                    Teoria
                  </summary>
                  <div className="mt-2 pl-4">
                    <p className="whitespace-pre-wrap">
                      {currentCard.theory_notes}
                    </p>
                  </div>
                </details>
              )}

              {/* Fontes com <details> */}
              {formattedSources.length > 0 && (
                <details className="bg-gray-100 dark:bg-gray-700 dark:bg-opacity-50 rounded p-2 text-sm">
                  <summary className="cursor-pointer font-semibold list-none">
                    Fontes
                  </summary>
                  <div className="mt-2 pl-4 space-y-1">
                    {formattedSources.map((source, index) => (
                      <p
                        key={index}
                        className="break-words"
                        dangerouslySetInnerHTML={{ __html: source }}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer Fixo com Botões */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 p-4 shadow-up">
        <div className="max-w-2xl mx-auto flex justify-center gap-4">
          {/* Botões de Escolha */}
          {!showAnswer && !isAnswered && (
            <>
              <button
                onClick={() => handleUserChoice("certo")}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow"
              >
                Certo
              </button>
              <button
                onClick={() => handleUserChoice("errado")}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow"
              >
                Errado
              </button>
            </>
          )}

          {/* Botão Mostrar Resposta */}
          {!showAnswer && isAnswered && (
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow"
            >
              Mostrar Resposta
            </button>
          )}

          {/* Botão Continuar / Próxima */}
          {showAnswer && (
            <button
              onClick={isAnswered ? goToNextCard : markCardAsStudiedAndContinue}
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow disabled:opacity-50"
            >
              {isProcessing
                ? "Salvando..."
                : isAnswered
                ? "Próxima"
                : "Continuar"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default StudyPage;
