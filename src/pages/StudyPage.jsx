// src/pages/StudyPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import attemptService from "../services/attemptService";
import deckService from "../services/deckService";
import { supabase } from "../supabaseClient";

// Função para embaralhar as cartas usando Fisher-Yates algorithm
const shuffleDeck = (cards) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Função para detectar URLs e transformar em links
const formatSourcesWithLinks = (sources) => {
  if (!sources) return [];

  if (Array.isArray(sources)) {
    return sources.map((source) => {
      // Verifica se é uma URL
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = source.match(urlRegex);

      if (matches) {
        // Substitui URLs por links
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
    });
  } else {
    // Se for string única
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = sources.match(urlRegex);

    if (matches) {
      let formattedSource = sources;
      matches.forEach((url) => {
        formattedSource = formattedSource.replace(
          url,
          `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${url}</a>`
        );
      });
      return [formattedSource];
    }
    return [sources];
  }
};

const StudyPage = () => {
  const { deckId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [deck, setDeck] = useState(null);
  const [userChoice, setUserChoice] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showTheory, setShowTheory] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [answeredCards, setAnsweredCards] = useState(new Set());

  // Carregar tentativa existente ou criar nova
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

  const continueAttempt = async (existingAttempt, deckCards) => {
    setAttempt(existingAttempt);

    // Criar mapa de cartas para acesso rápido
    const cardMap = new Map(deckCards.map((card) => [card.id, card]));

    // Recriar a ordem das cartas baseado no card_order salvo
    const remainingCards = existingAttempt.card_order
      .map((cardId) => cardMap.get(cardId))
      .filter(
        (card) => card && !existingAttempt.studied_cards?.includes(card.id)
      );

    setCards(remainingCards);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setUserChoice(null);
    setShowTheory(false);
    setShowSources(false);

    // Inicializar answeredCards com as cartas já respondidas
    const answered = new Set(existingAttempt.studied_cards || []);
    setAnsweredCards(answered);
  };

  const createNewAttempt = async (deckCards) => {
    // Embaralhar as cartas
    const shuffledCards = shuffleDeck([...deckCards]);
    const cardOrder = shuffledCards.map((card) => card.id);

    // Calcular número da tentativa
    const userAttempts = await attemptService.getUserAttempts(
      session.user.id,
      deckId
    );
    const attemptNumber = userAttempts.length + 1;

    // Criar nova tentativa
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
    });

    setAttempt(newAttempt);
    setCards(shuffledCards);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setUserChoice(null);
    setShowTheory(false);
    setShowSources(false);
    setAnsweredCards(new Set());
  };

  const handleUserChoice = (choice) => {
    if (!cards.length) return;

    const currentCard = cards[currentCardIndex];

    // Verificar se a carta já foi respondida
    if (answeredCards.has(currentCard.id)) {
      return; // Não permite responder novamente
    }

    const answerStartsWithCorrect = currentCard.back_content
      .toLowerCase()
      .startsWith("certo");
    const userIsCorrect =
      (choice === "certo" && answerStartsWithCorrect) ||
      (choice === "errado" && !answerStartsWithCorrect);

    setUserChoice(choice);
    setIsCorrect(userIsCorrect);
    setShowAnswer(true);
  };

  const markCardAsStudiedAndContinue = async () => {
    if (!attempt || cards.length === 0) return;

    const currentCard = cards[currentCardIndex];

    // Verificar se a carta já foi respondida
    if (answeredCards.has(currentCard.id)) {
      // Só avança sem salvar novamente
      goToNextCard();
      return;
    }

    const updatedStudiedCards = [
      ...(attempt.studied_cards || []),
      currentCard.id,
    ];

    try {
      // Atualizar contadores
      const updatedCorrectCount = isCorrect
        ? attempt.correct_count + 1
        : attempt.correct_count;
      const updatedIncorrectCount = !isCorrect
        ? attempt.incorrect_count + 1
        : attempt.incorrect_count;

      // Atualizar tentativa no banco
      const updatedAttempt = await attemptService.updateAttempt(attempt.id, {
        studied_cards: updatedStudiedCards,
        correct_count: updatedCorrectCount,
        incorrect_count: updatedIncorrectCount,
        last_studied_card_id: currentCard.id,
      });

      setAttempt(updatedAttempt);

      // Marcar como respondida
      setAnsweredCards((prev) => new Set([...prev, currentCard.id]));

      // Verificar se todas as cartas foram estudadas
      if (updatedStudiedCards.length === attempt.card_order.length) {
        await completeStudySession(updatedAttempt);
      } else {
        goToNextCard();
      }
    } catch (err) {
      setError("Erro ao salvar progresso");
      console.error("Error marking card as studied:", err);
    }
  };

  const completeStudySession = async (attemptData) => {
    try {
      const completedAttempt = await attemptService.completeAttempt(
        attemptData.id
      );
      setAttempt(completedAttempt);
      setCards([]);
    } catch (err) {
      setError("Erro ao finalizar sessão");
      console.error("Error completing study session:", err);
    }
  };

  const restartSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Embaralhar as cartas novamente na mesma tentativa
      const deckCards = await deckService.getDeckCards(deckId);
      const shuffledCards = shuffleDeck([...deckCards]);
      const cardOrder = shuffledCards.map((card) => card.id);

      // Atualizar a tentativa atual com nova ordem e resetar contadores
      const updatedAttempt = await attemptService.updateAttempt(attempt.id, {
        card_order: cardOrder,
        studied_cards: [],
        correct_count: 0,
        incorrect_count: 0,
        completed: false,
      });

      setAttempt(updatedAttempt);
      setCards(shuffledCards);
      setCurrentCardIndex(0);
      setShowAnswer(false);
      setUserChoice(null);
      setShowTheory(false);
      setShowSources(false);
      setAnsweredCards(new Set());
    } catch (err) {
      setError("Erro ao reiniciar sessão");
      console.error("Error restarting session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const pauseSession = () => {
    navigate(`/deck/${deckId}`);
  };

  const goToNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      setShowAnswer(false);
      setUserChoice(null);
      setShowTheory(false);
      setShowSources(false);
    }
  };

  const goToPrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1);
      setShowAnswer(false);
      setUserChoice(null);
      setShowTheory(false);
      setShowSources(false);
    }
  };

  // Verificar se a carta atual já foi respondida
  const isCardAnswered = () => {
    if (!cards.length) return false;
    const currentCard = cards[currentCardIndex];
    return answeredCards.has(currentCard.id);
  };

  // Renderizações de estado
  if (isLoading) {
    return (
      <div className="p-8 text-center dark:text-white">
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
      <div className="min-h-screen p-8 text-center dark:text-white">
        <h2 className="text-3xl font-bold mb-6">
          🎉 Parabéns! Sessão Concluída!
        </h2>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md mx-auto mb-6">
          <p className="font-semibold text-lg mb-4">
            Tentativa #{attempt.attempt_number}
          </p>
          <div className="space-y-2 text-left">
            <p>✅ Certas: {attempt.correct_count}</p>
            <p>❌ Erradas: {attempt.incorrect_count}</p>
            <p>📊 Total: {totalQuestions}</p>
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
            Iniciar Nova Sessão
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

  if (cards.length === 0) {
    return (
      <div className="p-8 text-center dark:text-white">
        <h2 className="text-2xl font-bold mb-4">Sessão de Estudo</h2>
        <p className="mb-6">Nenhuma carta para estudar no momento.</p>
        <button
          onClick={restartSession}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition"
        >
          Iniciar Nova Sessão de Estudo
        </button>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  const totalCards = attempt?.card_order?.length || 0;
  const studiedCount = attempt?.studied_cards?.length || 0;
  const progress = totalCards > 0 ? (studiedCount / totalCards) * 100 : 0;
  const isAnswered = isCardAnswered();

  // Formatar fontes com links
  const formattedSources = currentCard.source_references
    ? formatSourcesWithLinks(currentCard.source_references)
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Conteúdo Principal - Rola por trás dos botões fixos */}
      <div className="flex-1 p-4 pb-32">
        {/* Header com Barra de Progresso e Navegação Integrada */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
          <div className="flex flex-col gap-4">
            {/* Linha 1: Título, Estatísticas e Navegação */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold dark:text-white">
                  Sessão de Estudo - {deck?.name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Tentativa #{attempt?.attempt_number || 1}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-md font-semibold dark:text-white">
                  <span className="text-green-600 dark:text-green-400">
                    {attempt?.correct_count || 0}
                  </span>
                  <span>/</span>
                  <span className="text-red-600 dark:text-red-400">
                    {attempt?.incorrect_count || 0}
                  </span>
                  <span>/</span>
                  <span>{totalCards}</span>
                </span>

                {/* Navegação e Ações */}
                <div className="flex gap-3">
                  <button
                    onClick={goToPrevCard}
                    disabled={currentCardIndex === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-3 rounded-md transition text-sm flex items-center gap-1"
                  >
                    ◀️ <span className="hidden sm:inline">Anterior</span>
                  </button>

                  <span className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md font-bold dark:text-white text-sm">
                    {currentCardIndex + 1} / {cards.length}
                  </span>

                  <button
                    onClick={goToNextCard}
                    disabled={currentCardIndex === cards.length - 1}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-3 rounded-md transition text-sm flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Próxima</span> ▶️
                  </button>

                  <button
                    onClick={restartSession}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded-md transition text-sm flex items-center gap-1"
                  >
                    🔄 <span className="hidden sm:inline">Reiniciar</span>
                  </button>

                  <button
                    onClick={pauseSession}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-md transition text-sm flex items-center gap-1"
                  >
                    ⏸️ <span className="hidden sm:inline">Pausar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Linha 2: Barra de Progresso */}
            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>
                  {studiedCount} de {totalCards} cartas estudadas (
                  {Math.round(progress)}%)
                </span>
                <span className="font-semibold">
                  Restantes: {cards.length - currentCardIndex}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Flashcard */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow">
          <div className="text-center">
            {/* Pergunta */}
            <div className="prose prose-lg dark:prose-invert max-w-none mb-8">
              <h3 className="text-xl font-semibold mb-6 dark:text-white">
                {currentCard.front_content}
              </h3>

              {/* Mensagem se já foi respondida */}
              {isAnswered && !showAnswer && (
                <div className="bg-yellow-100 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <p className="text-yellow-700 dark:text-yellow-300 font-semibold">
                    Esta pergunta já foi respondida. Use "Mostrar Resposta" para
                    revisar.
                  </p>
                </div>
              )}

              {/* Feedback e Resposta */}
              {showAnswer && (
                <div className="space-y-6">
                  {/* Feedback do Resultado */}
                  <div
                    className={`p-4 rounded-lg ${
                      isCorrect
                        ? "bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700"
                        : "bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700"
                    }`}
                  >
                    <p
                      className={`text-lg font-semibold ${
                        isCorrect
                          ? "text-green-700 dark:text-green-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {isCorrect ? "✅ Você acertou!" : "❌ Você errou!"}
                    </p>
                  </div>

                  {/* Resposta */}
                  <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                      Resposta:
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 text-lg mb-6">
                      {currentCard.back_content}
                    </p>

                    {/* Teoria (Opcional) - Escondido por padrão */}
                    {currentCard.theory_notes && (
                      <div className="mb-4">
                        <button
                          onClick={() => setShowTheory(!showTheory)}
                          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold"
                        >
                          <span>📚 Teoria</span>
                          <span>{showTheory ? "▲" : "▼"}</span>
                        </button>
                        {showTheory && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 mt-2 text-left rounded">
                            <p className="text-blue-700 dark:text-blue-300 text-sm">
                              {currentCard.theory_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fontes (Opcional) - Escondido por padrão */}
                    {formattedSources.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowSources(!showSources)}
                          className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 font-semibold"
                        >
                          <span>📖 Fontes</span>
                          <span>{showSources ? "▲" : "▼"}</span>
                        </button>
                        {showSources && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 mt-2 text-left rounded">
                            <div className="space-y-2">
                              {formattedSources.map((source, index) => (
                                <p
                                  key={index}
                                  className="text-yellow-700 dark:text-yellow-300 text-sm"
                                  dangerouslySetInnerHTML={{ __html: source }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Área Fixa de Botões - Fica sempre visível na parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center">
            {/* Botões de Resposta - Grandes e com destaque */}
            <div className="flex gap-6 items-center">
              {/* Botões de Escolha - Só mostra se não estiver mostrando resposta e se não foi respondida */}
              {!showAnswer && !isAnswered && (
                <>
                  <button
                    onClick={() => handleUserChoice("certo")}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-12 rounded-md transition text-lg min-w-[160px] shadow-lg"
                  >
                    ✅ Certo
                  </button>

                  <button
                    onClick={() => handleUserChoice("errado")}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-12 rounded-md transition text-lg min-w-[160px] shadow-lg"
                  >
                    ❌ Errado
                  </button>
                </>
              )}

              {/* Botão Mostrar Resposta - Quando a carta já foi respondida mas a resposta não está visível */}
              {!showAnswer && isAnswered && (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-md transition text-lg min-w-[160px] shadow-lg"
                >
                  👆 Mostrar Resposta
                </button>
              )}

              {/* Botão Continuar - Mostra quando a resposta está visível e a carta não foi respondida */}
              {showAnswer && !isAnswered && (
                <button
                  onClick={markCardAsStudiedAndContinue}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-md transition text-lg min-w-[160px] shadow-lg"
                >
                  Continuar ▶️
                </button>
              )}

              {/* Botão para apenas avançar se já foi respondida */}
              {showAnswer && isAnswered && (
                <button
                  onClick={goToNextCard}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-md transition text-lg min-w-[160px] shadow-lg"
                >
                  Próxima ▶️
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyPage;
