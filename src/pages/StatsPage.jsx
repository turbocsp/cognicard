import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function StatsPage() {
  const { session } = useAuth();
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    const fetchDecks = async () => {
      if (!session) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("decks")
        .select("id, name")
        .eq("user_id", session.user.id);

      if (error) {
        toast.error("Erro ao buscar seus baralhos.");
      } else {
        setDecks(data);
        if (data.length > 0) {
          setSelectedDeckId(data[0].id);
        }
      }
      setLoading(false);
    };
    fetchDecks();
  }, [session]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedDeckId || !session) {
        setStats([]);
        return;
      }
      setLoadingStats(true);
      const { data, error } = await supabase.rpc("get_deck_statistics", {
        p_deck_id: selectedDeckId,
        p_user_id: session.user.id,
      });

      if (error) {
        toast.error("Erro ao buscar estatísticas do baralho.");
        setStats([]);
      } else {
        // Remove duplicates and process data
        const uniqueAttempts = new Map();
        data.forEach((item) => {
          uniqueAttempts.set(item.attempt_number, item);
        });

        const processedData = Array.from(uniqueAttempts.values())
          .map((item) => ({
            ...item,
            total_cards: item.correct_count + item.incorrect_count,
            accuracy:
              item.correct_count + item.incorrect_count > 0
                ? parseFloat(
                    (
                      (item.correct_count /
                        (item.correct_count + item.incorrect_count)) *
                      100
                    ).toFixed(2)
                  )
                : 0,
          }))
          .sort((a, b) => a.attempt_number - b.attempt_number); // Ensure it's sorted
        setStats(processedData);
      }
      setLoadingStats(false);
    };

    fetchStats();
  }, [selectedDeckId, session]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-900 dark:text-white">
        Carregando seus baralhos...
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold">Estatísticas de Estudo</h1>
        </header>

        <div className="mb-6">
          <label
            htmlFor="deck-select"
            className="block text-sm font-medium mb-2"
          >
            Selecione um Baralho:
          </label>
          <select
            id="deck-select"
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="w-full max-w-sm p-2 border rounded-md bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={decks.length === 0}
          >
            {decks.length > 0 ? (
              decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))
            ) : (
              <option>Nenhum baralho encontrado</option>
            )}
          </select>
        </div>

        {loadingStats ? (
          <p className="text-center">Carregando estatísticas...</p>
        ) : stats.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                Histórico de Tentativas
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      >
                        Tentativa
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      >
                        Acertos
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      >
                        Erros
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      >
                        Aproveitamento
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {stats.map((attempt) => (
                      <tr key={attempt.attempt_number}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {attempt.attempt_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-500">
                          {attempt.correct_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-red-500">
                          {attempt.incorrect_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {attempt.accuracy}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-96">
              <h2 className="text-xl font-semibold mb-4">
                Evolução do Aproveitamento (%)
              </h2>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={stats}
                  margin={{ top: 5, right: 20, left: -10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis
                    dataKey="attempt_number"
                    label={{
                      value: "Tentativa",
                      position: "insideBottom",
                      offset: -10,
                    }}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(31, 41, 55, 0.8)",
                      border: "1px solid #4b5563",
                    }}
                    labelStyle={{ color: "#d1d5db" }}
                    formatter={(value) => [`${value}%`, "Aproveitamento"]}
                  />
                  <Legend verticalAlign="top" />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    name="Aproveitamento"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-center mt-8">
            Nenhuma tentativa concluída registrada para este baralho.
          </p>
        )}
      </div>
    </div>
  );
}

export default StatsPage;
