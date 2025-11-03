// src/components/StudyInterface.jsx
import React from "react";
// Importamos a função de tempo que exportámos da StudyPage
import { formatTime } from "../pages/StudyPage";

// Este componente recebe MUITAS props,
// pois ele é apenas a "Vista" da lógica que fica na StudyPage.
export function StudyInterface({
  deck,
  attempt,
  currentCard,
  displayCardNumber,
  totalCardsInAttempt,
  progressPercent,
  elapsedTime,
  isProcessing,
  showAnswer,
  isCardAnswered,
  isCorrect,
  userChoice,
  formattedSources,
  onGoToPrev,
  onGoToNext,
  onRestart,
  onPause,
  onToggleShowAnswer,
  onUserChoice,
  onMarkAndContinue,
  isRestarting, // Passamos o status específico da mutação
  isMarking, // Passamos o status específico da mutação
}) {
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
              onClick={onGoToPrev}
              disabled={totalCardsInAttempt <= 1 || isProcessing}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50 text-xs"
            >
              Anterior
            </button>
            <span className="font-semibold">
              Card {displayCardNumber} / {totalCardsInAttempt}
            </span>
            <button
              onClick={onGoToNext}
              disabled={totalCardsInAttempt <= 1 || isProcessing}
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
              onClick={onRestart}
              disabled={isProcessing}
              className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs disabled:opacity-50"
              title="Reiniciar Tentativa Atual"
            >
              {isRestarting ? "🔄..." : "🔄"}
            </button>
            <button
              onClick={onPause}
              disabled={isProcessing}
              className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs disabled:opacity-50"
              title="Pausar e Sair"
            >
              ⏸️
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 pb-24">
        {currentCard ? (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-2xl text-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">
              {currentCard.title || deck?.name || "Estudo"}
            </h2>
            <div className="mb-6 min-h-[100px] flex items-center justify-center">
              {/* Garantir que o conteúdo seja renderizado como parágrafos */}
              <p className="text-lg whitespace-pre-wrap">
                {currentCard.front_content}
              </p>
            </div>

            {isCardAnswered && !showAnswer && (
              <button
                onClick={onToggleShowAnswer}
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

                <p className="text-base whitespace-pre-wrap">
                  {currentCard.back_content}
                </p>

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
                          // Adiciona 'whitespace-pre-wrap' se as fontes puderem ter quebras de linha
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
          <div className="text-center dark:text-white">
            Preparando sessão...
          </div>
        )}
      </main>

      {/* Footer Fixo com Botões */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 p-4 shadow-up">
        <div className="max-w-2xl mx-auto flex justify-center gap-4">
          {!showAnswer && !isCardAnswered && (
            <>
              <button
                onClick={() => onUserChoice("certo")}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow disabled:opacity-50"
              >
                Certo
              </button>
              <button
                onClick={() => onUserChoice("errado")}
                disabled={isProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow disabled:opacity-50"
              >
                Errado
              </button>
            </>
          )}

          {showAnswer && (
            <button
              onClick={isCardAnswered ? onGoToNext : onMarkAndContinue}
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md transition text-lg shadow disabled:opacity-50"
            >
              {isMarking
                ? "Salvando..."
                : isCardAnswered
                ? "Próxima"
                : "Continuar"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
