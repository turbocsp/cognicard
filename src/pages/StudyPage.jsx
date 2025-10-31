// src/pages/StudyPage.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"; // Adicionado useRef e useCallback
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import attemptService from "../services/attemptService";
import deckService from "../services/deckService";
import { supabase } from "@/supabaseClient";
import { toast } from "react-hot-toast";
import { InactivityModal } from "@/components/InactivityModal"; // <<< Importar Modal
import { format } from 'date-fns'; // <<< Importar format do date-fns

// Função shuffleDeck (sem alterações)
const shuffleDeck = (cards) => {
  // ... (código existente)
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Função formatSourcesWithLinks (sem alterações)
const formatSourcesWithLinks = (sources) => {
  // ... (código existente)
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


// <<< Helper para formatar o tempo >>>
const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');

    if (hours > 0) {
        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    } else {
        return `${paddedMinutes}:${paddedSeconds}`;
    }
};

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos em milissegundos
const SAVE_INTERVAL = 30 * 1000; // Salvar progresso a cada 30 segundos (opcional, mas bom para robustez)

const StudyPage = () => {
  const { deckId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();

  // Estados
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

  // <<< Novos estados para o timer e inatividade >>>
  const [elapsedTime, setElapsedTime] = useState(0); // Tempo em segundos
  const [timerIsActive, setTimerIsActive] = useState(false);
  const [lastActivityTimestamp, setLastActivityTimestamp] = useState(Date.now());
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const inactivityTimerRef = useRef(null); // Ref para o timer de checagem de inatividade
  const saveTimerRef = useRef(null); // Ref para o timer de salvamento periódico
  const inactiveTimeStartRef = useRef(null); // Ref para guardar quando a inatividade começou

  // <<< Estado para estatísticas de conclusão >>>
   const [completionStats, setCompletionStats] = useState({
       attemptTime: 0,
       deckTimeToday: 0,
       totalTimeToday: 0,
   });


  // Hooks useMemo (sem alterações)
  const currentCard = useMemo(() => {
     // ... (código existente)
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
     // ... (código existente)
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
     // ... (código existente)
      if (!currentCard) return false;
        return answeredCards.has(currentCard.id);
  };

  // --- Funções ---

  // <<< Função para atualizar o timestamp da última atividade >>>
  const updateLastActivity = useCallback(() => {
    setLastActivityTimestamp(Date.now());
  }, []);

  // <<< Função para salvar o tempo decorrido no banco >>>
  const saveElapsedTime = useCallback(async (currentTime) => {
    if (attempt?.id && currentTime > 0) { // Só salva se houver tentativa e tempo > 0
        try {
            // Usamos 'upsert' caso a tentativa ainda não exista totalmente (pouco provável aqui)
            // ou apenas 'update' se tiver certeza que 'attempt' está sempre carregado
            await attemptService.updateAttempt(attempt.id, {
                elapsed_seconds: Math.floor(currentTime) // Garante que é inteiro
            });
            // console.log("Tempo salvo:", Math.floor(currentTime)); // Para debug
        } catch (saveError) {
            console.error("Erro ao salvar tempo decorrido:", saveError);
            // Poderia adicionar um toast aqui, mas pode ser irritante se falhar muito
        }
    }
  }, [attempt?.id]); // Depende do ID da tentativa


  // useEffect principal de carregamento (modificado para carregar tempo)
  useEffect(() => {
    if (!deckId || !session?.user?.id) {
      setError("Deck não selecionado ou usuário não autenticado.");
      setIsLoading(false);
      return;
    }
    loadStudySession();
    // Limpeza ao desmontar: para o timer e salva o tempo
    return () => {
        setTimerIsActive(false); // Isso vai limpar o intervalo do timer principal
        // Salva o tempo atual ao sair da página
        // Precisamos acessar o valor mais recente do estado elapsedTime aqui
        // Usar uma ref ou buscar o valor diretamente antes de salvar pode ser necessário
        // Para simplificar, vamos confiar que o estado está razoavelmente atualizado
        // ou usar o save periódico. O save periódico é mais robusto.
    };
  }, [deckId, session]); // Roda só quando deckId ou session mudam


  // <<< useEffect para o contador principal >>>
  useEffect(() => {
    let intervalId = null;
    if (timerIsActive && !isLoading && !attempt?.completed && !isInactiveModalOpen) {
      intervalId = setInterval(() => {
        setElapsedTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(intervalId);
    }
    // Limpeza: para o intervalo quando o componente desmonta ou timerIsActive muda
    return () => clearInterval(intervalId);
  }, [timerIsActive, isLoading, attempt?.completed, isInactiveModalOpen]);


  // <<< useEffect para detecção de inatividade >>>
  useEffect(() => {
     // Limpa timer anterior ao re-executar
     if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
     }

     if (timerIsActive && !isInactiveModalOpen) { // Só checa inatividade se o timer principal está ativo e o modal fechado
        inactivityTimerRef.current = setInterval(() => {
            const now = Date.now();
            if (now - lastActivityTimestamp > INACTIVITY_TIMEOUT) {
                console.log("Inatividade detectada!");
                setTimerIsActive(false); // Pausa o contador principal
                inactiveTimeStartRef.current = lastActivityTimestamp; // Guarda quando a inatividade começou (aproximadamente)
                setIsInactiveModalOpen(true); // Abre o modal
                clearInterval(inactivityTimerRef.current); // Para de checar inatividade
            }
        }, 5000); // Checa a cada 5 segundos
     }

     // Limpeza
     return () => {
        if (inactivityTimerRef.current) {
            clearInterval(inactivityTimerRef.current);
        }
     };
  }, [timerIsActive, lastActivityTimestamp, isInactiveModalOpen, updateLastActivity]); // Reavalia quando o timer ou a atividade mudam


  // <<< useEffect para salvamento periódico >>>
  useEffect(() => {
      // Limpa timer anterior
      if (saveTimerRef.current) {
          clearInterval(saveTimerRef.current);
      }

      // Configura novo timer se o timer principal estiver ativo
      if (timerIsActive && attempt?.id) {
          saveTimerRef.current = setInterval(() => {
              // Precisamos do valor mais recente de elapsedTime aqui
              // Usar a forma funcional do setState garante isso
              setElapsedTime(currentTime => {
                  saveElapsedTime(currentTime); // Salva o tempo atual
                  return currentTime; // Não muda o tempo, só usa o valor atual para salvar
              });
          }, SAVE_INTERVAL);
      }

      // Limpeza
      return () => {
          if (saveTimerRef.current) {
              clearInterval(saveTimerRef.current);
          }
      };
  }, [timerIsActive, attempt?.id, saveElapsedTime]); // Depende do timer e do ID da tentativa


  // Função loadStudySession (modificada para carregar tempo)
  const loadStudySession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setTimerIsActive(false); // Garante que timer está parado durante o load

      const deckData = await deckService.getDeck(deckId);
      setDeck(deckData);

      const deckCards = await deckService.getDeckCards(deckId);
       if (deckCards.length === 0) {
            throw new Error("Nenhuma carta encontrada neste baralho.");
       }
      setAllCardsMap(new Map(deckCards.map((card) => [card.id, card])));


      const activeAttempt = await attemptService.getActiveAttempt(
        deckId,
        session.user.id
      );

      if (activeAttempt && !activeAttempt.completed) {
        await continueAttempt(activeAttempt, deckCards);
         // <<< Inicia o timer após continuar >>>
         updateLastActivity(); // Define o ponto inicial de atividade
         setTimerIsActive(true);
      } else {
        // Se não há tentativa ativa, busca a última completa para pegar o número correto
         const userAttempts = await attemptService.getUserAttempts(
            session.user.id,
            deckId
         );
         const lastAttemptNumber = userAttempts.length > 0 ? Math.max(...userAttempts.map(a => a.attempt_number)) : 0;

        await createNewAttempt(deckCards, lastAttemptNumber); // Passa o último número
         // <<< Inicia o timer após criar >>>
         updateLastActivity();
         setTimerIsActive(true);
      }
    } catch (err) {
      console.error("Erro detalhado:", err);
      setError(`Erro ao carregar sessão: ${err.message}`);
      setTimerIsActive(false); // Garante que o timer não rode se der erro
    } finally {
      setIsLoading(false);
    }
  };


  // Função continueAttempt (modificada para carregar tempo)
  const continueAttempt = async (existingAttempt, allDeckCards) => {
    setAttempt(existingAttempt);
    // <<< Carrega o tempo salvo >>>
    setElapsedTime(existingAttempt.elapsed_seconds || 0);

    const cardMap = new Map(allDeckCards.map((card) => [card.id, card]));
     // ... (resto da lógica de continuar tentativa SEM alterações)
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
    // <<< Timer é iniciado em loadStudySession após chamar continueAttempt >>>
  };

  // Função createNewAttempt (modificada para resetar tempo e aceitar lastAttemptNumber)
  const createNewAttempt = async (allDeckCards, lastAttemptNumber = 0) => {
    const shuffledCards = shuffleDeck([...allDeckCards]);
    const cardOrder = shuffledCards.map((card) => card.id);

    const attemptNumber = lastAttemptNumber + 1; // Usa o número passado + 1

    // <<< Reseta o tempo ao criar nova >>>
    setElapsedTime(0);

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
      elapsed_seconds: 0, // <<< Garante que começa com 0 no DB >>>
    });

    setAttempt(newAttempt);
    setCardsInCurrentView(shuffledCards);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setUserChoice(null);
    setAnsweredCards(new Set());
    // <<< Timer é iniciado em loadStudySession após chamar createNewAttempt >>>
  };

   // Função startNewAttempt (modificada para passar o attemptNumber atual)
  const startNewAttempt = async () => {
    if (!session?.user?.id || !deckId || isProcessing) return;

    try {
        setIsProcessing(true);
        setError(null);
        setIsLoading(true);
        setTimerIsActive(false); // Para timer atual

        const currentAttemptNumber = attempt?.attempt_number || 0; // Pega o número da tentativa atual (completa)

        const deckCards = await deckService.getDeckCards(deckId);
        if (deckCards.length === 0) {
            throw new Error("Nenhuma carta encontrada neste baralho para iniciar uma nova tentativa.");
        }

        // Passa o número da tentativa atual para que createNewAttempt calcule o próximo
        await createNewAttempt(deckCards, currentAttemptNumber);

        // Inicia o timer para a nova tentativa
        updateLastActivity();
        setTimerIsActive(true);

        toast.success("Nova tentativa iniciada!");

    } catch (err) {
        setError("Erro ao iniciar nova tentativa");
        console.error("Error starting new attempt:", err);
        toast.error("Não foi possível iniciar uma nova tentativa.");
        setTimerIsActive(false); // Garante que o timer não rode se der erro
    } finally {
        setIsProcessing(false);
        setIsLoading(false);
    }
  };


  // addStudyLog (sem alterações)
  const addStudyLog = async (cardId, wasCorrect) => {
     // ... (código existente)
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

  // handleUserChoice (modificada para atualizar atividade)
  const handleUserChoice = (choice) => {
     // ... (código existente)
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
    // <<< Atualiza atividade >>>
    updateLastActivity();
  };

  // markCardAsStudiedAndContinue (modificada para atualizar atividade)
  const markCardAsStudiedAndContinue = async () => {
     // ... (código existente)
       if (!attempt || !currentCard || isProcessing) return;

        setIsProcessing(true);

        if (answeredCards.has(currentCard.id)) {
        goToNextCard(); // Ainda atualiza atividade ao navegar
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
                // elapsed_seconds: elapsedTime // Salvo periodicamente ou ao pausar/completar
            });

            setAttempt(updatedAttempt);

             // <<< Atualiza atividade após salvar >>>
             updateLastActivity();

            if (updatedStudiedCards.length === attempt.card_order.length) {
                await completeStudySession(updatedAttempt);
            } else {
                goToNextCard(); // goToNextCard também atualiza atividade
            }
        } catch (err) {
        // ... (tratamento de erro)
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

 // completeStudySession (modificada para salvar tempo final e buscar estatísticas)
 const completeStudySession = async (attemptData) => {
    if (!attemptData || attemptData.completed || isProcessing) return;

    try {
        setIsProcessing(true);
        setTimerIsActive(false); // Para o timer antes de salvar final

        // Salva o tempo final exato desta tentativa
        const finalElapsedTime = elapsedTime; // Pega o valor atual do estado
        await saveElapsedTime(finalElapsedTime);

        // Marca a tentativa como completa no banco
        const completedAttempt = await attemptService.completeAttempt(attemptData.id);

        // Busca os tempos totais do dia APÓS completar a tentativa atual
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: dailyTimesData, error: dailyTimesError } = await supabase.rpc(
            'get_daily_study_times',
            { p_user_id: session.user.id, p_date: today }
        );

        if (dailyTimesError) {
            console.error("Erro ao buscar tempos diários:", dailyTimesError);
            toast.error("Não foi possível buscar os tempos totais do dia.");
            // Continua mesmo se a busca de estatísticas falhar
        }

        // Encontra o tempo do deck atual e o tempo total de hoje
        let deckTimeToday = 0;
        let totalTimeToday = 0;
        if (dailyTimesData && dailyTimesData.length > 0) {
             // O RPC retorna o total geral em todas as linhas, pegamos da primeira
            totalTimeToday = dailyTimesData[0].total_seconds_all || 0;
            // Procuramos a linha específica deste deck
            const deckEntry = dailyTimesData.find(d => d.deck_id === deckId);
            if (deckEntry) {
                deckTimeToday = deckEntry.total_seconds_deck || 0;
            }
        }


        // Atualiza o estado das estatísticas de conclusão
        setCompletionStats({
            attemptTime: Math.floor(finalElapsedTime), // Usa o tempo final salvo
            deckTimeToday: deckTimeToday,
            totalTimeToday: totalTimeToday,
        });

        // Atualiza o estado da tentativa para refletir a conclusão
        // Isso fará a UI mudar para a tela de "Parabéns"
        setAttempt(completedAttempt);

    } catch (err) {
        setError("Erro ao finalizar sessão");
        console.error("Error completing study session:", err);
        toast.error("Erro ao finalizar a sessão de estudo.");
        setTimerIsActive(true); // Retoma o timer se a finalização falhar? Ou deixa parado? Decisão: deixar parado.
    } finally {
        setIsProcessing(false);
    }
  };


  // restartSession (NÃO reseta o timer)
  const restartSession = async () => {
     // ... (lógica existente para resetar contadores, cartas, etc.)
      if (!attempt || isProcessing) return;

        try {
        setIsProcessing(true);
        setError(null);
        setTimerIsActive(false); // Pausa o timer durante o reinício

        const deckCards = await deckService.getDeckCards(deckId);
        if (deckCards.length === 0) {
            throw new Error(
            "Nenhuma carta encontrada neste baralho para reiniciar"
            );
        }
        setAllCardsMap(new Map(deckCards.map((card) => [card.id, card])));

        const shuffledCards = shuffleDeck([...deckCards]);
        const cardOrder = shuffledCards.map((card) => card.id);

        const updatedAttempt = await attemptService.updateAttempt(attempt.id, {
            card_order: cardOrder,
            studied_cards: [],
            correct_count: 0,
            incorrect_count: 0,
            completed: false,
            completed_at: null,
            last_studied_card_id: null,
             // <<< NÃO ALTERA elapsed_seconds >>>
        });

        setAttempt(updatedAttempt);
        setCardsInCurrentView(shuffledCards);
        setCurrentCardIndex(0);
        setShowAnswer(false);
        setUserChoice(null);
        setAnsweredCards(new Set());
        // setElapsedTime(0); // <<< NÃO RESETA o tempo >>>

        // <<< Reinicia o timer e a atividade >>>
        updateLastActivity();
        setTimerIsActive(true);

        toast.success("Tentativa reiniciada (contadores zerados)!");
        } catch (err) {
        setError("Erro ao reiniciar tentativa");
        console.error("Error restarting session:", err);
        toast.error("Não foi possível reiniciar a tentativa.");
         setTimerIsActive(true); // Tenta retomar o timer se falhar
        } finally {
        setIsProcessing(false);
        }
  };

  // pauseSession (modificada para salvar tempo)
  const pauseSession = async () => {
    setTimerIsActive(false); // Para o timer
    await saveElapsedTime(elapsedTime); // Salva o tempo atual antes de navegar
    navigate(`/deck/${deckId}`);
  };

  // goToNextCard e goToPrevCard (modificadas para atualizar atividade)
  const goToNextCard = () => {
     // ... (lógica existente)
      if (currentCardIndex < cardsInCurrentView.length - 1) {
        setCurrentCardIndex((prev) => prev + 1);
        setShowAnswer(false);
        setUserChoice(null);
        updateLastActivity(); // <<< Atualiza atividade >>>
        } else if (
        cardsInCurrentView.length > 0 &&
        currentCardIndex === cardsInCurrentView.length - 1 &&
        !attempt?.completed
        ) {
         toast.info("Você chegou ao final dos cards restantes nesta tentativa.");
         updateLastActivity(); // <<< Atualiza atividade >>> (mesmo no final)
        }
  };

  const goToPrevCard = () => {
     // ... (lógica existente)
      if (currentCardIndex > 0) {
        setCurrentCardIndex((prev) => prev - 1);
        setShowAnswer(false);
        setUserChoice(null);
        updateLastActivity(); // <<< Atualiza atividade >>>
        }
  };

  // <<< Funções para o Modal de Inatividade >>>
  const handleContinueInactive = () => {
    setIsInactiveModalOpen(false);
    updateLastActivity();
    setTimerIsActive(true); // Retoma o timer principal
  };

  const handleRestartQuestionInactive = () => {
     const inactiveDurationMs = Date.now() - (inactiveTimeStartRef.current || Date.now());
     // Calcula quantos segundos *inteiros* de inatividade (mínimo 5 min = 300s, mas pode ser mais)
     const inactiveSeconds = Math.max(300, Math.floor(inactiveDurationMs / 1000));

    // Desconta o tempo do estado
    setElapsedTime(prevTime => Math.max(0, prevTime - inactiveSeconds));

    // Fecha modal, atualiza atividade, retoma timer
    setIsInactiveModalOpen(false);
    updateLastActivity();
    setTimerIsActive(true);

    // Opcional: Resetar a visualização da questão atual (se necessário)
    // setShowAnswer(false);
    // setUserChoice(null);
    toast.info(`Tempo de inatividade (${formatTime(inactiveSeconds)}) descontado.`);
  };


  // --- Renderização ---

  // Loading e Error (sem alterações)
  if (isLoading) {
     // ... (código existente)
      return (
        <div className="flex justify-center items-center min-h-screen dark:text-white">
            Carregando sessão de estudo...
        </div>
        );
  }
   if (error) {
     // ... (código existente)
      return (
            <div className="p-8 text-center dark:text-white">
                <div className="text-red-500 mb-4">{error}</div>
                <div className="flex gap-4 justify-center">
                <button
                    onClick={loadStudySession} // Tenta recarregar a sessão
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

  // Tela de Conclusão (ATUALIZADA com tempos)
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
              {new Date(attempt.completed_at).toLocaleDateString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
            </p>
             {/* <<< Exibição dos Tempos >>> */}
             <p className="border-t pt-2 mt-2 dark:border-gray-600">
                ⏱️ Tempo desta tentativa:{" "}
                <span className="font-semibold">{formatTime(completionStats.attemptTime)}</span>
             </p>
              <p>
                📚 Tempo neste baralho hoje:{" "}
                <span className="font-semibold">{formatTime(completionStats.deckTimeToday)}</span>
             </p>
              <p>
                🗓️ Tempo total estudado hoje:{" "}
                <span className="font-semibold">{formatTime(completionStats.totalTimeToday)}</span>
             </p>
          </div>
        </div>
        <div className="flex gap-4 justify-center">
           {/* Botão Nova Tentativa */}
          <button
            onClick={startNewAttempt}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50"
          >
             {isProcessing ? "Iniciando..." : "Nova Tentativa"}
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

  // Tela "Fim da Tentativa" (sem alterações)
   if (cardsInCurrentView.length === 0 && !isLoading && !attempt?.completed) {
     // ... (código existente)
      return (
        <div className="min-h-screen flex flex-col justify-center items-center p-4 text-center dark:text-white">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md w-full mb-6">
                <h2 className="text-2xl font-bold mb-4">Fim da Tentativa</h2>
                <p className="mb-6">Você já estudou todas as cartas disponíveis nesta tentativa.</p>
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
                 {/* Mantém o botão Reiniciar aqui, pois a tentativa NÃO está completa */}
                <button
                    onClick={restartSession}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-md transition"
                     disabled={isProcessing}
                >
                    Reiniciar Tentativa Atual
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

  // Renderização do Card Atual
  const isAnswered = isCardAnswered();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header Compactado (ATUALIZADO com Timer) */}
      <header className="w-full p-3 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
         <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-y-2 text-xs sm:text-sm">
          {/* Lado Esquerdo */}
          <div className="flex items-center gap-3">
            <span
              className="font-semibold truncate max-w-[100px] sm:max-w-[150px]" // Reduzido um pouco
              title={deck?.name}
            >
              {deck?.name || "Estudo"}
            </span>
             {/* <<< Exibição do Timer >>> */}
             <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-sm">
                 ⏱️ {formatTime(elapsedTime)}
             </span>
             {/* <<< Fim do Timer >>> */}
            <span>Tentativa: {attempt?.attempt_number || 1}</span>
            <span> {/* Estatísticas sempre visíveis */}
              {attempt?.correct_count || 0} ✅ / {attempt?.incorrect_count || 0}{" "}
              ❌ / {totalCardsInDeckAttempt} 🃏
            </span>
          </div>

          {/* Centro: Navegação */}
          <div className="flex items-center gap-2 order-3 sm:order-2 w-full sm:w-auto justify-center">
            {/* ... (Botões Anterior/Próximo e contador de card) ... */}
              <button
                onClick={goToPrevCard}
                disabled={currentCardIndex === 0 || isProcessing}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 text-xs"
                >
                Anterior
                </button>
                <span className="font-semibold">
                Card {displayCardNumber} / {totalCardsInDeckAttempt}
                </span>
                <button
                onClick={goToNextCard}
                disabled={currentCardIndex >= cardsInCurrentView.length - 1 || isProcessing}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 text-xs"
                >
                Próximo
                </button>
          </div>

          {/* Lado Direito */}
          <div className="flex items-center gap-3 order-2 sm:order-3">
            {/* ... (Barra de progresso, percentual, botões Reiniciar e Pausar) ... */}
             <div className="w-16 sm:w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
              title="Reiniciar Tentativa Atual"
            >
              🔄
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


      {/* Conteúdo Principal (sem alterações) */}
       <main className="flex-1 flex flex-col items-center justify-center p-4 pb-24">
         {/* ... (código do card principal existente com a exibição do título já aplicada) ... */}
           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-2xl text-center">
            {/* Título (Nome do Cartão ou Deck) */}
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

      {/* Footer Fixo com Botões (sem alterações) */}
       <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 p-4 shadow-up">
        {/* ... (código dos botões Certo/Errado/Continuar/Mostrar Resposta) ... */}
        <div className="max-w-2xl mx-auto flex justify-center gap-4">
          {/* Botões de Escolha */}
          {!showAnswer && !isAnswered && (
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

          {/* Botão Mostrar Resposta */}
          {!showAnswer && isAnswered && (
            <button
              onClick={() => { setShowAnswer(true); updateLastActivity(); }} // Atualiza atividade ao mostrar resposta
               disabled={isProcessing}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow disabled:opacity-50"
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

       {/* <<< Renderiza o Modal de Inatividade >>> */}
       <InactivityModal
            isOpen={isInactiveModalOpen}
            onContinue={handleContinueInactive}
            onRestartQuestion={handleRestartQuestionInactive}
       />
    </div>
  );
};

export default StudyPage;
