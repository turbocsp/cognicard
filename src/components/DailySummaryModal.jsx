import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/supabaseClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DailySummaryModal({ isOpen, onClose, date, session }) {
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState("all");

  useEffect(() => {
    if (isOpen && date && session?.user?.id) {
      const fetchSummary = async () => {
        setLoading(true);
        setSummary({});
        setSelectedDeck("all"); // Reset filter on new modal open
        const { data, error } = await supabase.rpc("get_daily_summary", {
          p_user_id: session.user.id,
          p_date: format(date, "yyyy-MM-dd"),
        });

        if (error) {
          console.error("Error fetching daily summary:", error);
        } else {
          const groupedSummary = data.reduce((acc, item) => {
            if (!acc[item.deck_name]) {
              acc[item.deck_name] = [];
            }
            acc[item.deck_name].push(item);
            return acc;
          }, {});
          setSummary(groupedSummary);
        }
        setLoading(false);
      };
      fetchSummary();
    }
  }, [isOpen, date, session]);

  const filteredSummary = useMemo(() => {
    if (selectedDeck === "all") {
      return summary;
    }
    return summary[selectedDeck]
      ? { [selectedDeck]: summary[selectedDeck] }
      : {};
  }, [summary, selectedDeck]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">
            Resumo de{" "}
            {date ? format(date, "dd MMMM yyyy", { locale: ptBR }) : ""}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {Object.keys(summary).length > 1 && (
          <div className="mb-4">
            <label
              htmlFor="deck-filter"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Filtrar por baralho
            </label>
            <select
              id="deck-filter"
              value={selectedDeck}
              onChange={(e) => setSelectedDeck(e.target.value)}
              className="w-full p-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos os Baralhos</option>
              {Object.keys(summary)
                .sort()
                .map((deckName) => (
                  <option key={deckName} value={deckName}>
                    {deckName}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          {loading ? (
            <p>Carregando...</p>
          ) : Object.keys(filteredSummary).length > 0 ? (
            <ul className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {Object.entries(filteredSummary).map(([deckName, attempts]) => {
                const totals = attempts.reduce(
                  (acc, attempt) => {
                    acc.correct += attempt.correct_count;
                    acc.incorrect += attempt.incorrect_count;
                    return acc;
                  },
                  { correct: 0, incorrect: 0 }
                );
                const grandTotal = totals.correct + totals.incorrect;
                const overallPercentage =
                  grandTotal > 0
                    ? ((totals.correct / grandTotal) * 100).toFixed(0)
                    : 0;

                return (
                  <li
                    key={deckName}
                    className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md"
                  >
                    <p className="font-semibold truncate mb-2 pb-2 border-b border-gray-200 dark:border-gray-600">
                      {deckName}
                    </p>
                    <ul className="space-y-2">
                      {attempts.map((item) => {
                        const total = item.correct_count + item.incorrect_count;
                        const percentage =
                          total > 0
                            ? ((item.correct_count / total) * 100).toFixed(0)
                            : 0;
                        return (
                          <li key={item.attempt_number} className="text-sm">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                Tentativa{" "}
                                {String(item.attempt_number).padStart(2, "0")}
                              </span>
                              <span
                                className={`font-bold text-base ${
                                  percentage >= 75
                                    ? "text-green-500"
                                    : percentage >= 50
                                    ? "text-yellow-500"
                                    : "text-red-500"
                                }`}
                              >
                                {percentage}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs mt-1 text-gray-500 dark:text-gray-400">
                              <span>
                                Acertos:{" "}
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  {item.correct_count}
                                </span>
                              </span>
                              <span>
                                Erros:{" "}
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                  {item.incorrect_count}
                                </span>
                              </span>
                              <span>
                                Total:{" "}
                                <span className="font-semibold text-gray-700 dark:text-gray-200">
                                  {total}
                                </span>
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {attempts.length > 1 && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-sm">
                        <p className="font-bold text-center mb-2 text-gray-800 dark:text-gray-200">
                          Consolidado do Dia
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Total de Tentativas: {attempts.length}
                          </span>
                          <span
                            className={`font-bold text-base ${
                              overallPercentage >= 75
                                ? "text-green-500"
                                : overallPercentage >= 50
                                ? "text-yellow-500"
                                : "text-red-500"
                            }`}
                          >
                            {overallPercentage}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs mt-1 text-gray-500 dark:text-gray-400">
                          <span>
                            Acertos:{" "}
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {totals.correct}
                            </span>
                          </span>
                          <span>
                            Erros:{" "}
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {totals.incorrect}
                            </span>
                          </span>
                          <span>
                            Total:{" "}
                            <span className="font-semibold text-gray-700 dark:text-gray-200">
                              {grandTotal}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>Nenhuma sessão de estudo encontrada para este dia.</p>
          )}
        </div>
      </div>
    </div>
  );
}
