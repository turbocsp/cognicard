// src/pages/StatsPage.jsx
import { useState, useEffect, useMemo } from "react";
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

import { useQuery } from "@tanstack/react-query";
// Vamos precisar dos dois serviços para obter os dados do cache
import deckService from "@/services/deckService";
import folderService from "@/services/folderService";

function StatsPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [selectedDeckId, setSelectedDeckId] = useState("");

  // --- useQuery para buscar Baralhos (Decks) ---
  const { data: decks = [], isLoading: isLoadingDecks } = useQuery({
    queryKey: ["decks", userId],
    queryFn: () => deckService.getUserDecks(userId), //
    enabled: !!userId,
  });

  // --- useQuery para buscar Pastas (Folders) ---
  const { data: folders = [], isLoading: isLoadingFolders } = useQuery({
    queryKey: ["folders", userId],
    queryFn: () => folderService.getUserFolders(userId), //
    enabled: !!userId,
  });

  // <<< ATUALIZAÇÃO PRINCIPAL (useMemo) >>>
  // --- Criar a lista de exibição com o caminho completo ---
  const deckDisplayList = useMemo(() => {
    // 1. Criar um mapa para acesso rápido às pastas por ID
    const folderMap = new Map(folders.map((f) => [f.id, f]));

    // 2. Função auxiliar recursiva para construir o caminho
    const getFolderPath = (folderId) => {
      let path = [];
      let currentFolder = folderMap.get(folderId);

      // Navega "para cima" na árvore até a raiz (limite de 10 níveis para evitar loops)
      let safetyCounter = 0;
      while (currentFolder && safetyCounter < 10) {
        path.unshift(currentFolder.name); // Adiciona o nome no início
        currentFolder = folderMap.get(currentFolder.parent_folder_id);
        safetyCounter++;
      }
      return path.join(" / "); // Retorna "PastaMae / PastaFilha"
    };

    // 3. Mapear os baralhos para a lista de exibição
    return (
      decks
        .map((deck) => {
          const path = getFolderPath(deck.folder_id);
          const displayName = path
            ? `${path} / ${deck.name}` // Ex: "Química / Tabela Periódica"
            : deck.name; // Ex: "Baralho Raiz"

          return {
            id: deck.id,
            displayName: displayName,
          };
        })
        // 4. Ordenar alfabeticamente pelo nome de exibição completo
        .sort((a, b) =>
          a.displayName.localeCompare(b.displayName, "pt-BR", {
            sensitivity: "base",
          })
        )
    );
  }, [decks, folders]); // Recalcula se os decks ou as pastas mudarem

  // --- Efeito para selecionar o primeiro baralho (Inalterado) ---
  useEffect(() => {
    if (!selectedDeckId && deckDisplayList.length > 0) {
      setSelectedDeckId(deckDisplayList[0].id);
    }
  }, [deckDisplayList, selectedDeckId]);

  // --- useQuery para buscar Estatísticas (Inalterado) ---
  const { data: rawStatsData = [], isLoading: isLoadingStats } = useQuery({
    queryKey: ["deckStats", selectedDeckId, userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_deck_statistics", {
        p_deck_id: selectedDeckId,
        p_user_id: userId,
      });
      if (error) {
        toast.error("Erro ao buscar estatísticas do baralho.");
        throw error;
      }
      return data || [];
    },
    enabled: !!selectedDeckId && !!userId,
  });

  // --- useMemo para processar Estatísticas (Inalterado) ---
  const stats = useMemo(() => {
    const uniqueAttempts = new Map();
    rawStatsData.forEach((item) => {
      uniqueAttempts.set(item.attempt_number, item);
    });

    return Array.from(uniqueAttempts.values())
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
      .sort((a, b) => a.attempt_number - b.attempt_number);
  }, [rawStatsData]);

  // --- Renderização ---
  if (isLoadingDecks || isLoadingFolders) {
    return (
      <div className="p-8 text-center text-gray-900 dark:text-white">
        Carregando seus baralhos...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Estatísticas de Estudo</h1>
      </header>

      <div className="mb-6">
        <label htmlFor="deck-select" className="block text-sm font-medium mb-2">
          Selecione um Baralho:
        </label>
        <select
          id="deck-select"
          value={selectedDeckId}
          onChange={(e) => setSelectedDeckId(e.target.value)}
          className="w-full max-w-sm p-2 border rounded-md bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={deckDisplayList.length === 0 || isLoadingStats}
        >
          {deckDisplayList.length > 0 ? (
            // <<< ATUALIZADO: Renderiza o displayName completo >>>
            deckDisplayList.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.displayName}
              </option>
            ))
          ) : (
            <option>Nenhum baralho encontrado</option>
          )}
        </select>
      </div>

      {/* O restante do JSX (tabela e gráficos) permanece o mesmo */}
      {isLoadingStats ? (
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
  );
}

export default StatsPage;
