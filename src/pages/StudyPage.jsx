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

// ... (Funções helper shuffleDeck, formatSourcesWithLinks, formatTime inalteradas) ...
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
const formatTime = (totalSeconds) => {
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
  const { deckId } = useParams();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Estados Locais (UI e Lógica de Navegação) ---
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

  // ... (Estados de timer e inatividade) ...
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

  // --- Carregamento de Dados (useQuery) ---
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

  // --- Memos ---
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

  // --- Funções de Lógica da Sessão (Definições) ---
  const resetCardState = () => {
    setShowAnswer(false);
    setUserChoice(null);
  };

  const updateLastActivity = () => {
    setLastActivityTimestamp(Date.now());
  };

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
      // Não deveria acontecer se chamado por markCard, mas por segurança
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

  // --- MUTAÇÕES ---

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
      // Rollback local
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

  // --- Estado de Processamento Global (Derivado) ---
  const isProcessing =
    markCardMutation.isPending ||
    completeSessionMutation.isPending ||
    startNewAttemptMutation.isPending ||
    restartSessionMutation.isPending ||
    createNewAttemptMutation.isPending;

  // --- useEffect de Carregamento Principal (CORRIGIDO) ---
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
      // Cenário A: Continua tentativa
      continueAttempt(activeAttempt, cardMap);
      updateLastActivity();
      setTimerIsActive(true);
      setIsLoading(false);
    } else if (activeAttempt === null) {
      // Cenário B: Cria nova tentativa
      const startNew = async () => {
        setIsLoading(true); // Garante que fica em loading
        try {
          const userAttempts = await attemptService.getUserAttempts(
            userId,
            deckId
          );
          const lastAttemptNumber =
            userAttempts.length > 0
              ? Math.max(...userAttempts.map((a) => a.attempt_number))
              : 0;

          // Chama a mutação e ESPERA
          await createNewAttemptMutation.mutateAsync({
            deckCards,
            lastAttemptNumber,
          });

          updateLastActivity();
          setTimerIsActive(true); // Liga o timer
        } catch (err) {
          setError(`Erro ao criar nova sessão: ${err.message}`);
        } finally {
          setIsLoading(false); // Libera a UI
        }
      };
      startNew();
    } else if (activeAttempt && activeAttempt.completed) {
      // Cenário C: Tentativa carregada já estava completa
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
  ]);

  // --- Handlers de UI ---

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
      // Chama a mutação silenciosa
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
    const wasLastCard = remainingCardIds.size === 1; // (Verifica o tamanho *antes* da atualização do estado)

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

  // --- Hooks de Timer (Definidos após as dependências) ---
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

  // --- Renderização ---

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

  // (Tela de Conclusão)
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
          <p className="font-semibold text-lg mb-2">
            Tentativa #{attempt.attempt_number}
          </p>
          <div className="space-y-1 text-left text-sm mb-4">
            <p>✅ Certas: {attempt.correct_count}</p>
            <p>❌ Erradas: {attempt.incorrect_count}</p>
            <p>📊 Total Respondidas: {totalQuestions}</p>
            <p>🎯 Precisão: {accuracy}%</p>
            <p>
              🏁 Concluído em:{" "}
              {new Date(attempt.completed_at).toLocaleDateString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="border-t pt-2 mt-2 dark:border-gray-600">
              ⏱️ Tempo desta tentativa:{" "}
              <span className="font-semibold">
                {formatTime(completionStats.attemptTime)}
              </span>
            </p>
            <p>
              📚 Tempo neste baralho hoje:{" "}
              <span className="font-semibold">
                {formatTime(completionStats.deckTimeToday)}
              </span>
            </p>
            <p>
              🗓️ Tempo total estudado hoje:{" "}
              <span className="font-semibold">
                {formatTime(completionStats.totalTimeToday)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => startNewAttemptMutation.mutate()}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50"
          >
            {startNewAttemptMutation.isPending
              ? "Iniciando..."
              : "Nova Tentativa"}
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

  // (Tela "Fim da Tentativa" / Todos Respondidos)
  if (
    remainingCardIds.size === 0 &&
    !isLoading &&
    !attempt?.completed &&
    !isProcessing
  ) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 text-center dark:text-white">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md w-full mb-6">
          <h2 className="text-2xl font-bold mb-4">Fim da Tentativa</h2>
          <p className="mb-6">Você respondeu todos os cartões.</p>
          <p>✅ Certas: {attempt?.correct_count || 0}</p>
          <p>❌ Erradas: {attempt?.incorrect_count || 0}</p>
          <button
            onClick={() => completeSessionMutation.mutate(attempt)}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition"
            disabled={isProcessing}
          >
            {completeSessionMutation.isPending
              ? "Finalizando..."
              : "Finalizar Sessão"}
          </button>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => restartSessionMutation.mutate()}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-md transition"
            disabled={isProcessing}
          >
            {restartSessionMutation.isPending
              ? "Reiniciando..."
              : "Reiniciar Tentativa Atual"}
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header Compactado */}
      <header className="w-full p-3 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-y-2 text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <span
              className="font-semibold truncate max-w-[100px] sm:max-w-[150px]"
              title={deck?.name}
            >
              {deck?.name || "Estudo"}
            </span>
            <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-sm">
              ⏱️ {formatTime(elapsedTime)}
            </span>
            <span>Tentativa: {attempt?.attempt_number || 1}</span>
            <span>
              {attempt?.correct_count || 0} ✅ / {attempt?.incorrect_count || 0}{" "}
              ❌ / {totalCardsInAttempt} 🃏
            </span>
          </div>

          <div className="flex items-center gap-2 order-3 sm:order-2 w-full sm:w-auto justify-center">
            <button
              onClick={goToPrevCard}
              disabled={allCardsInAttempt.length <= 1 || isProcessing}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 text-xs"
            >
              Anterior
            </button>
            <span className="font-semibold">
              Card {displayCardNumber} / {totalCardsInAttempt}
            </span>
            <button
              onClick={goToNextCard}
              disabled={allCardsInAttempt.length <= 1 || isProcessing}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 text-xs"
            >
              Próximo
            </button>
          </div>

          <div className="flex items-center gap-3 order-2 sm:order-3">
            <div className="w-16 sm:w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
                title={`${Math.round(progressPercent)}% concluído`}
              ></div>
            </div>
            <span>{Math.round(progressPercent)}%</span>
            <button
              onClick={() => restartSessionMutation.mutate()}
              disabled={isProcessing}
              className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs disabled:opacity-50"
              title="Reiniciar Tentativa Atual"
            >
              {restartSessionMutation.isPending ? "🔄..." : "🔄"}
            </button>
            <button
              onClick={pauseSession}
              disabled={isProcessing}
              className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs disabled:opacity-50"
              title="Pausar e Sair"
            >
              ⏸️
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal (Correção Bug 1 e 2) */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 pb-24">
        {currentCard ? (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-2xl text-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">
              {currentCard.title || deck?.name || "Estudo"}
            </h2>
            <div className="mb-6 min-h-[100px] flex items-center justify-center">
              <p className="text-lg">{currentCard.front_content}</p>
            </div>

            {isCardAnswered && !showAnswer && (
              <button
                onClick={() => {
                  setShowAnswer(true);
                  updateLastActivity();
                }}
                disabled={isProcessing}
                className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded-md w-full text-left cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-800 disabled:opacity-50"
              >
                <p className="text-yellow-800 dark:text-yellow-200">
                  Você já respondeu este card. Clique para ver a resposta.
                </p>
              </button>
            )}

            {showAnswer && (
              <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-4 text-left">
                {userChoice !== null ? (
                  <p
                    className={`font-bold text-lg ${
                      isCorrect
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {isCorrect ? "✅ Você Acertou!" : "❌ Você Errou!"}
                  </p>
                ) : (
                  isCardAnswered && (
                    <p className="font-bold text-lg text-gray-500 dark:text-gray-400">
                      Revisando Resposta:
                    </p>
                  )
                )}

                <p className="text-base">{currentCard.back_content}</p>

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
        ) : (
          // Este fallback só aparece se 'isLoading' for false mas 'currentCard' ainda for nulo
          <div className="text-center dark:text-white">
            Preparando sessão...
          </div>
        )}
      </main>

      {/* Footer Fixo com Botões (Corrigido) */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 p-4 shadow-up">
        <div className="max-w-2xl mx-auto flex justify-center gap-4">
          {/* <<< CORREÇÃO (Bug 1): Só mostra se NÃO respondido E NÃO visível >>> */}
          {!showAnswer && !isCardAnswered && (
            <>
              <button
                onClick={() => handleUserChoice("certo")}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow disabled:opacity-50"
              >
                Certo
              </button>
              <button
                onClick={() => handleUserChoice("errado")}
                disabled={isProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow disabled:opacity-50"
              >
                Errado
              </button>
            </>
          )}

          {/* Botão Continuar / Próxima (Só aparece se a resposta está visível) */}
          {showAnswer && (
            <button
              // <<< CORREÇÃO: Chama a função handler correta >>>
              onClick={
                isCardAnswered ? goToNextCard : markCardAsStudiedAndContinue
              }
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow disabled:opacity-50"
            >
              {markCardMutation.isPending
                ? "Salvando..."
                : isCardAnswered
                ? "Próxima"
                : "Continuar"}
            </button>
          )}
        </div>
      </footer>

      {/* Modal de Inatividade (Inalterado) */}
      <InactivityModal
        isOpen={isInactiveModalOpen}
        onContinue={handleContinueInactive}
        onRestartQuestion={handleRestartQuestionInactive}
      />
    </div>
  );
};

export default StudyPage;
