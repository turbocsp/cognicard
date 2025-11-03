// src/pages/SearchPage.jsx
import { useState, useEffect } from "react"; // <<< useEffect removido
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/supabaseClient";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// <<< 1. Importar useQuery >>>
import { useQuery } from "@tanstack/react-query";

function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q");
  const { session } = useAuth();
  const userId = session?.user?.id;

  // --- 2. Remover estados manuais de dados e loading ---
  // [REMOVIDO] const [results, setResults] = useState([]);
  // [REMOVIDO] const [loading, setLoading] = useState(true);
  // [REMOVIDO] useEffect(() => { performSearch() }, [query, session]);

  // --- 3. Substituir por useQuery ---
  const { data: results = [], isLoading: loading } = useQuery({
    // A queryKey inclui o termo de busca (query) e o userId.
    // Se o 'query' mudar, esta busca será executada novamente.
    queryKey: ["search", query, userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_cards", {
        //
        search_term: query,
        p_user_id: userId,
      });

      if (error) {
        toast.error(`Erro ao buscar: ${error.message}`);
        throw error; // Lança o erro para o React Query tratar
      }
      return data || [];
    },
    // A query só executa se 'query' e 'userId' existirem
    enabled: !!query && !!userId,
  });

  // --- 4. O JSX permanece quase idêntico, apenas usa os estados do useQuery ---
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <Link
            to="/dashboard"
            className="text-blue-500 hover:underline mb-4 block"
          >
            &larr; Voltar ao Painel
          </Link>
          <h1 className="text-3xl font-bold">
            Resultados para: <span className="text-blue-500">{query}</span>
          </h1>
          {!loading && ( // <<< Usa 'loading' do useQuery
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {results.length}{" "}
              {results.length === 1
                ? "cartão encontrado"
                : "cartões encontrados"}
            </p>
          )}
        </header>

        {loading ? ( // <<< Usa 'loading' do useQuery
          <p className="text-center">Buscando...</p>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            {results.map(
              (
                card // <<< Usa 'results' do useQuery
              ) => (
                <div
                  key={card.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow"
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {card.front_content}
                    </ReactMarkdown>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 mb-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {card.back_content}
                    </ReactMarkdown>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-sm">
                    <span className="font-semibold">Baralho:</span>
                    <Link
                      to={`/deck/${card.deck_id}`}
                      className="text-blue-500 hover:underline"
                    >
                      {card.deck_name}
                    </Link>
                    {card.tags && card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 ml-auto">
                        {card.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-center mt-8 text-gray-500">
            Nenhum cartão encontrado com o termo "{query}".
          </p>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
