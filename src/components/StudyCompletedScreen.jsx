// src/components/StudyCompletedScreen.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
// Importamos a função de tempo que exportámos da StudyPage
import { formatTime } from "../pages/StudyPage";

export function StudyCompletedScreen({
  attempt,
  completionStats,
  onStartNewAttempt,
  isProcessing,
}) {
  const navigate = useNavigate();
  // Usa o deck_id da tentativa para saber para onde voltar
  const { deck_id } = attempt;

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
          onClick={onStartNewAttempt}
          disabled={isProcessing}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50"
        >
          {isProcessing ? "Iniciando..." : "Nova Tentativa"}
        </button>
        <button
          onClick={() => navigate(`/deck/${deck_id}`)}
          className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition"
        >
          Voltar ao Baralho
        </button>
      </div>
    </div>
  );
}
