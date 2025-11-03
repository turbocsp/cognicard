// src/pages/StudyPage.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import attemptService from "../services/attemptService";
import deckService from "../services/deckService";
import { supabase } from "@/supabaseClient";
import { toast } from "react-hot-toast";
import { InactivityModal } from "@/components/InactivityModal";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// <<< 1. Importar os novos componentes de Vista >>>
// (Assumindo que foram criados em /src/components/)
import { StudyCompletedScreen } from "@/components/StudyCompletedScreen";
import { StudyInterface } from "@/components/StudyInterface";

// ... (Função helper shuffleDeck e formatSourcesWithLinks) ...
const shuffleDeck = (cards) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
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

// <<< 2. EXPORTAR a função formatTime para os outros componentes a usarem >>>
export const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  } else {
    return `${paddedMinutes}:${paddedSeconds}`;
  }
};

const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const SAVE_INTERVAL = 30 * 1000;

const StudyPage = () => {
  // --- Estados e Hooks (Toda a lógica permanece aqui) ---
  const { deckId } = useParams();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // (Estados da UI)
  const [attempt, setAttempt] = useState(null);
  const [allCardsInAttempt, setAllCardsInAttempt] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [answeredCards, setAnsweredCards] = useState(new Set());
  const [remainingCardIds, setRemainingCardIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [deck, setDeck] = useState(null);
  const [userChoice, setUserChoice] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerIsActive, setTimerIsActive] = useState(false);
  const [lastActivityTimestamp, setLastActivityTimestamp] = useState(
    Date.now()
  );
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const inactivityTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const inactiveTimeStartRef = useRef(null);
  const [completionStats, setCompletionStats] = useState({
    attemptTime: 0,
    deckTimeToday: 0,
    totalTimeToday: 0,
  });

  // (useQuery para dados)
  const { data: deckAndCardsData, isLoading: isLoadingDeckAndCards } = useQuery(
    {
      queryKey: ["studySessionData", deckId],
      queryFn: async () => {
        const deckData = await deckService.getDeck(deckId);
        const deckCards = await deckService.getDeckCards(deckId);
        if (deckCards.length === 0) {
          throw new Error("Nenhuma carta encontrada neste baralho.");
        }
        return { deckData, deckCards };
      },
      enabled: !!deckId && !!userId,
      refetchOnWindowFocus: false,
    }
  );

  const { data: activeAttemptResult, isLoading: isLoadingAttempt } = useQuery({
    queryKey: ["activeAttempt", deckId, userId],
    queryFn: () => attemptService.getActiveAttempt(deckId, userId),
    enabled: !!deckId && !!userId,
    refetchOnWindowFocus: false,
  });

  // (Memos para estados derivados)
  const currentCard = useMemo(() => {
    if (allCardsInAttempt && currentCardIndex < allCardsInAttempt.length) {
      return allCardsInAttempt[currentCardIndex];
    }
    return null;
  }, [allCardsInAttempt, currentCardIndex]);
  const totalCardsInAttempt = allCardsInAttempt.length;
  const studiedCount = answeredCards.size;
  const progressPercent =
    totalCardsInAttempt > 0 ? (studiedCount / totalCardsInAttempt) * 100 : 0;
  const displayCardNumber = currentCardIndex + 1;
  const formattedSources = currentCard?.source_references
    ? formatSourcesWithLinks(currentCard.source_references)
    : [];
  const isCardAnswered = useMemo(() => {
    if (!currentCard) return false;
    return answeredCards.has(currentCard.id);
  }, [currentCard, answeredCards]);

  // (Funções de lógica interna)
  const resetCardState = () => {
    setShowAnswer(false);
    setUserChoice(null);
  };

  const updateLastActivity = useCallback(() => {
    setLastActivityTimestamp(Date.now());
  }, []);

  const continueAttempt = (existingAttempt, cardMap) => {
    setAttempt(existingAttempt);
    setElapsedTime(existingAttempt.elapsed_seconds || 0);
    const allCards = existingAttempt.card_order
      .map((cardId) => cardMap.get(cardId))
      .filter((card) => card);
    setAllCardsInAttempt(allCards);
    const studiedSet = new Set(existingAttempt.studied_cards || []);
    const remainingSet = new Set(
      allCards.map((c) => c.id).filter((id) => !studiedSet.has(id))
    );
    setAnsweredCards(studiedSet);
    setRemainingCardIds(remainingSet);
    let startIndex = 0;
    if (existingAttempt.last_studied_card_id) {
      const lastStudiedOriginalIndex = allCards.findIndex(
        (card) => card.id === existingAttempt.last_studied_card_id
      );
      if (lastStudiedOriginalIndex !== -1) {
        startIndex = Math.min(
          lastStudiedOriginalIndex + 1,
          allCards.length - 1
        );
      }
    }
    if (studiedSet.has(allCards[startIndex]?.id) && remainingSet.size > 0) {
      let nextUnansweredIndex = -1;
      for (let i = startIndex; i < allCards.length; i++) {
        if (remainingSet.has(allCards[i].id)) {
          nextUnansweredIndex = i;
          break;
        }
      }
      if (nextUnansweredIndex === -1) {
        for (let i = 0; i < startIndex; i++) {
          if (remainingSet.has(allCards[i].id)) {
            nextUnansweredIndex = i;
            break;
          }
        }
      }
      setCurrentCardIndex(nextUnansweredIndex !== -1 ? nextUnansweredIndex : 0);
    } else {
      setCurrentCardIndex(startIndex);
    }
    resetCardState();
  };

  const findNextUnansweredCard = (startIndex) => {
    if (remainingCardIds.size === 0) {
      return;
    }
    for (let i = startIndex + 1; i < allCardsInAttempt.length; i++) {
      if (remainingCardIds.has(allCardsInAttempt[i].id)) {
        setCurrentCardIndex(i);
        return;
      }
    }
    for (let i = 0; i <= startIndex; i++) {
      if (remainingCardIds.has(allCardsInAttempt[i].id)) {
        setCurrentCardIndex(i);
        return;
      }
    }
  };

  // (Mutações)
  const saveTimeMutation = useMutation({
    mutationFn: ({ attemptId, time }) =>
      attemptService.updateAttempt(attemptId, {
        elapsed_seconds: Math.floor(time),
      }),
    onError: (error) =>
      console.error("Erro ao salvar tempo (background):", error.message),
  });

  const saveElapsedTime = useCallback(
    (currentTime) => {
      if (attempt?.id && currentTime > 0) {
        saveTimeMutation.mutate({ attemptId: attempt.id, time: currentTime });
      }
    },
    [attempt?.id, saveTimeMutation]
  );

  const studyLogMutation = useMutation({
    mutationFn: (logData) => supabase.from("study_log").insert(logData),
    onError: (error) =>
      console.error(
        "Erro ao salvar log de estudo (background):",
        error.message
      ),
  });

  const createNewAttemptMutation = useMutation({
    mutationFn: async ({ deckCards, lastAttemptNumber }) => {
      const shuffledCards = shuffleDeck([...deckCards]);
      const cardOrder = shuffledCards.map((card) => card.id);
      const attemptNumber = lastAttemptNumber + 1;
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
        elapsed_seconds: 0,
      });
      return { newAttempt, shuffledCards, cardOrder };
    },
    onSuccess: ({ newAttempt, shuffledCards, cardOrder }) => {
      setAttempt(newAttempt);
      setAllCardsInAttempt(shuffledCards);
      setCurrentCardIndex(0);
      setAnsweredCards(new Set());
      setRemainingCardIds(new Set(cardOrder));
      setElapsedTime(0);
      resetCardState();
    },
  });

  const startNewAttemptMutation = useMutation({
    mutationFn: async () => {
      setTimerIsActive(false);
      const userAttempts = await attemptService.getUserAttempts(userId, deckId);
      const lastAttemptNumber =
        userAttempts.length > 0
          ? Math.max(...userAttempts.map((a) => a.attempt_number))
          : 0;
      const deckCards = deckAndCardsData.deckCards;
      if (deckCards.length === 0) {
        throw new Error("Nenhuma carta encontrada neste baralho.");
      }
      await createNewAttemptMutation.mutateAsync({
        deckCards,
        lastAttemptNumber,
      });
    },
    onSuccess: () => {
      updateLastActivity();
      setTimerIsActive(true);
      toast.success("Nova tentativa iniciada!");
    },
    onError: (err) => {
      setError("Erro ao iniciar nova tentativa");
      console.error("Error starting new attempt:", err);
      toast.error("Não foi possível iniciar uma nova tentativa.");
      setTimerIsActive(false);
    },
  });

  const restartSessionMutation = useMutation({
    mutationFn: async () => {
      setTimerIsActive(false);
      const deckCards = [...allCardsInAttempt];
      if (deckCards.length === 0) {
        throw new Error("Nenhuma carta encontrada para reiniciar");
      }
      const shuffledCards = shuffleDeck(deckCards);
      const cardOrder = shuffledCards.map((card) => card.id);
      const updatedAttempt = await attemptService.updateAttempt(attempt.id, {
        card_order: cardOrder,
        studied_cards: [],
        correct_count: 0,
        incorrect_count: 0,
        completed: false,
        completed_at: null,
        last_studied_card_id: null,
      });
      return { updatedAttempt, shuffledCards, cardOrder };
    },
    onSuccess: ({ updatedAttempt, shuffledCards, cardOrder }) => {
      setAttempt(updatedAttempt);
      setAllCardsInAttempt(shuffledCards);
      setCurrentCardIndex(0);
      setAnsweredCards(new Set());
      setRemainingCardIds(new Set(cardOrder));
      resetCardState();
      updateLastActivity();
      setTimerIsActive(true);
      toast.success("Tentativa reiniciada (contadores zerados)!");
    },
    onError: (err) => {
      setError("Erro ao reiniciar tentativa");
      console.error("Error restarting session:", err);
      toast.error("Não foi possível reiniciar a tentativa.");
      setTimerIsActive(true);
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async (attemptData) => {
      setTimerIsActive(false);
      const finalElapsedTime = elapsedTime;
      await saveTimeMutation.mutateAsync({
        attemptId: attemptData.id,
        time: finalElapsedTime,
      });
      const completedAttempt = await attemptService.completeAttempt(
        attemptData.id
      );
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: dailyTimesData, error: dailyTimesError } =
        await supabase.rpc("get_daily_study_times", {
          p_user_id: session.user.id,
          p_date: today,
        });
      return {
        completedAttempt,
        finalElapsedTime,
        dailyTimesData,
        dailyTimesError,
      };
    },
    onSuccess: ({
      completedAttempt,
      finalElapsedTime,
      dailyTimesData,
      dailyTimesError,
    }) => {
      if (dailyTimesError) {
        console.error("Erro ao buscar tempos diários:", dailyTimesError);
        toast.error("Não foi possível buscar os tempos totais do dia.");
      }
      let deckTimeToday = 0;
      let totalTimeToday = 0;
      if (dailyTimesData && dailyTimesData.length > 0) {
        totalTimeToday = dailyTimesData[0].total_seconds_all || 0;
        const deckEntry = dailyTimesData.find((d) => d.deck_id === deckId);
        if (deckEntry) {
          deckTimeToday = deckEntry.total_seconds_deck || 0;
        }
      }
      setCompletionStats({
        attemptTime: Math.floor(finalElapsedTime),
        deckTimeToday: deckTimeToday,
        totalTimeToday: totalTimeToday,
      });
      setAttempt(completedAttempt);
    },
    onError: (err) => {
      setError("Erro ao finalizar sessão");
      console.error("Error completing study session:", err);
      toast.error("Erro ao finalizar a sessão de estudo.");
    },
  });

  const markCardMutation = useMutation({
    mutationFn: async ({ answeredCardId, updatedStudiedCards }) => {
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
        last_studied_card_id: answeredCardId,
      });
      return updatedAttempt;
    },
    onSuccess: (updatedAttempt, { wasLastCard }) => {
      setAttempt(updatedAttempt);
      updateLastActivity();
      if (wasLastCard) {
        completeSessionMutation.mutate(updatedAttempt);
      } else {
        findNextUnansweredCard(currentCardIndex);
        resetCardState();
      }
    },
    onError: (err, { answeredCardId }) => {
      setAnsweredCards((prev) => {
        const newSet = new Set(prev);
        newSet.delete(answeredCardId);
        return newSet;
      });
      setRemainingCardIds((prev) => new Set(prev).add(answeredCardId));
      setError("Erro ao salvar progresso");
      console.error("Error marking card as studied:", err);
      toast.error("Erro ao salvar seu progresso. Tente novamente.");
    },
  });

  // (Estado de Processamento Global Derivado)
  const isProcessing =
    markCardMutation.isPending ||
    completeSessionMutation.isPending ||
    startNewAttemptMutation.isPending ||
    restartSessionMutation.isPending ||
    createNewAttemptMutation.isPending;

  // (useEffect de Carregamento Principal)
  useEffect(() => {
    if (isLoadingDeckAndCards || isLoadingAttempt) {
      setIsLoading(true);
      return;
    }
    if (!deckAndCardsData) {
      setError("Erro ao carregar sessão de estudo.");
      setIsLoading(false);
      return;
    }
    const { deckData, deckCards } = deckAndCardsData;
    const cardMap = new Map(deckCards.map((card) => [card.id, card]));
    setDeck(deckData);
    setTimerIsActive(false);
    const activeAttempt = activeAttemptResult;
    if (activeAttempt && !activeAttempt.completed) {
      continueAttempt(activeAttempt, cardMap);
      updateLastActivity();
      setTimerIsActive(true);
      setIsLoading(false);
    } else if (activeAttempt === null) {
      const startNew = async () => {
        setIsLoading(true);
        try {
          const userAttempts = await attemptService.getUserAttempts(
            userId,
            deckId
          );
          const lastAttemptNumber =
            userAttempts.length > 0
              ? Math.max(...userAttempts.map((a) => a.attempt_number))
              : 0;
          await createNewAttemptMutation.mutateAsync({
            deckCards,
            lastAttemptNumber,
          });
          updateLastActivity();
          setTimerIsActive(true);
        } catch (err) {
          setError(`Erro ao criar nova sessão: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      startNew();
    } else if (activeAttempt && activeAttempt.completed) {
      setAttempt(activeAttempt);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deckAndCardsData,
    activeAttemptResult,
    isLoadingDeckAndCards,
    isLoadingAttempt,
    userId,
    deckId,
    // Os callbacks foram removidos das dependências
  ]);

  // (Handlers de UI)
  const handleUserChoice = (choice) => {
    if (!currentCard || showAnswer || isCardAnswered) return;
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
    studyLogMutation.mutate({
      user_id: userId,
      card_id: currentCard.id,
      attempt_id: attempt.id,
      was_correct: userIsCorrect,
    });
    updateLastActivity();
  };
  const markCardAsStudiedAndContinue = () => {
    if (!attempt || !currentCard || isProcessing || isCardAnswered) return;
    const answeredCardId = currentCard.id;
    setAnsweredCards((prev) => new Set(prev).add(answeredCardId));
    setRemainingCardIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(answeredCardId);
      return newSet;
    });
    const updatedStudiedCards = [...answeredCards, answeredCardId];
    const wasLastCard = remainingCardIds.size === 1;
    markCardMutation.mutate({
      answeredCardId,
      updatedStudiedCards,
      wasLastCard,
    });
  };
  const pauseSession = () => {
    setTimerIsActive(false);
    saveElapsedTime(elapsedTime);
    navigate(`/deck/${deckId}`);
  };
  const goToNextCard = () => {
    updateLastActivity();
    if (!currentCard || allCardsInAttempt.length === 0) return;
    if (!isCardAnswered) {
      findNextUnansweredCard(currentCardIndex);
    } else {
      const nextIndex = (currentCardIndex + 1) % allCardsInAttempt.length;
      setCurrentCardIndex(nextIndex);
    }
    resetCardState();
  };
  const goToPrevCard = () => {
    updateLastActivity();
    if (allCardsInAttempt.length === 0) return;
    const prevIndex =
      (currentCardIndex - 1 + allCardsInAttempt.length) %
      allCardsInAttempt.length;
    setCurrentCardIndex(prevIndex);
    resetCardState();
  };
  const handleContinueInactive = () => {
    setIsInactiveModalOpen(false);
    updateLastActivity();
    setTimerIsActive(true);
  };
  const handleRestartQuestionInactive = () => {
    const inactiveDurationMs =
      Date.now() - (inactiveTimeStartRef.current || Date.now());
    const inactiveSeconds = Math.max(
      300,
      Math.floor(inactiveDurationMs / 1000)
    );
    setElapsedTime((prevTime) => Math.max(0, prevTime - inactiveSeconds));
    setIsInactiveModalOpen(false);
    updateLastActivity();
    setTimerIsActive(true);
    toast.info(
      `Tempo de inatividade (${formatTime(inactiveSeconds)}) descontado.`
    );
  };

  // (Hooks de Timer)
  useEffect(() => {
    let intervalId = null;
    if (
      timerIsActive &&
      !isLoading &&
      !attempt?.completed &&
      !isInactiveModalOpen
    ) {
      intervalId = setInterval(() => {
        setElapsedTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(intervalId);
    }
    return () => clearInterval(intervalId);
  }, [timerIsActive, isLoading, attempt?.completed, isInactiveModalOpen]);
  useEffect(() => {
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
    }
    if (timerIsActive && !isInactiveModalOpen) {
      inactivityTimerRef.current = setInterval(() => {
        const now = Date.now();
        if (now - lastActivityTimestamp > INACTIVITY_TIMEOUT) {
          setTimerIsActive(false);
          inactiveTimeStartRef.current = lastActivityTimestamp;
          setIsInactiveModalOpen(true);
          clearInterval(inactivityTimerRef.current);
        }
      }, 5000);
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [timerIsActive, lastActivityTimestamp, isInactiveModalOpen]);
  useEffect(() => {
    if (saveTimerRef.current) {
      clearInterval(saveTimerRef.current);
    }
    if (timerIsActive && attempt?.id) {
      saveTimerRef.current = setInterval(() => {
        setElapsedTime((currentTime) => {
          saveElapsedTime(currentTime);
          return currentTime;
        });
      }, SAVE_INTERVAL);
    }
    return () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
      }
    };
  }, [timerIsActive, attempt?.id, saveElapsedTime]);

  // --- 3. Lógica de Renderização Limpa ---

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
            onClick={() => {
              queryClient.invalidateQueries({
                queryKey: ["studySessionData", deckId],
              });
              queryClient.invalidateQueries({
                queryKey: ["activeAttempt", deckId, userId],
              });
            }}
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

  // Vista 1: Tela de "Parabéns"
  if (attempt?.completed) {
    return (
      <StudyCompletedScreen
        attempt={attempt}
        completionStats={completionStats}
        onStartNewAttempt={() => startNewAttemptMutation.mutate()}
        isProcessing={startNewAttemptMutation.isPending}
      />
    );
  }

  // <<< Bloco "Fim da Tentativa" REMOVIDO >>>

  // Vista 2: A Interface de Estudo Principal
  return (
    <>
      <StudyInterface
        deck={deck}
        attempt={attempt}
        currentCard={currentCard}
        displayCardNumber={displayCardNumber}
        totalCardsInAttempt={totalCardsInAttempt}
        progressPercent={progressPercent}
        elapsedTime={elapsedTime}
        isProcessing={isProcessing}
        isMarking={markCardMutation.isPending}
        isRestarting={restartSessionMutation.isPending}
        showAnswer={showAnswer}
        isCardAnswered={isCardAnswered}
        isCorrect={isCorrect}
        userChoice={userChoice}
        formattedSources={formattedSources}
        onGoToPrev={goToPrevCard}
        onGoToNext={goToNextCard}
        onRestart={() => restartSessionMutation.mutate()}
        onPause={pauseSession}
        onToggleShowAnswer={() => {
          setShowAnswer(true);
          updateLastActivity();
        }}
        onUserChoice={handleUserChoice}
        onMarkAndContinue={markCardAsStudiedAndContinue}
      />

      <InactivityModal
        isOpen={isInactiveModalOpen}
        onContinue={handleContinueInactive}
        onRestartQuestion={handleRestartQuestionInactive}
      />
    </>
  );
};

export default StudyPage;
