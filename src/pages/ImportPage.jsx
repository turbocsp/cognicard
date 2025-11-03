// src/pages/ImportPage.jsx
import { useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { supabase } from "@/supabaseClient";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";

// <<< 1. Importar useMutation e useQueryClient >>>
import { useMutation, useQueryClient } from "@tanstack/react-query";

const TARGET_FIELDS = [
  // ... (TARGET_FIELDS inalterado) ...
  { value: "ignore", label: "Ignorar esta coluna" },
  { value: "title", label: "Título do Cartão" },
  { value: "front_content", label: "Frente (Pergunta)" },
  { value: "back_content", label: "Verso (Resposta)" },
  { value: "theory_notes", label: "Teoria" },
  { value: "source_references", label: "Fontes (separadas por vírgula)" },
  { value: "tags", label: "Tags (separadas por vírgula)" },
];

const DELIMITERS = [
  // ... (DELIMITERS inalterado) ...
  { value: "", label: "Automático" },
  { value: ",", label: "Vírgula (,)" },
  { value: ";", label: "Ponto e vírgula (;)" },
  { value: "|", label: "Pipe (|)" },
  { value: "\t", label: "Tabulação (Tab)" },
];

function ImportPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const userId = session?.user?.id;

  // <<< 2. Obter o Query Client >>>
  const queryClient = useQueryClient();

  // --- Estados de UI ---
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [delimiter, setDelimiter] = useState("");
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [step, setStep] = useState(1);
  const fullCsvData = useRef([]);

  // --- 3. Remover estados de loading manuais ---
  // [REMOVIDO] const [isAnalyzing, setIsAnalyzing] = useState(false);
  // [REMOVIDO] const [isImporting, setIsImporting] = useState(false);

  // --- 4. Criar a Mutação de Análise ---
  const analyzeMutation = useMutation({
    mutationFn: (fileToParse) => {
      // O Papa.parse é baseado em callbacks, por isso "prometemos" ele
      return new Promise((resolve, reject) => {
        Papa.parse(fileToParse, {
          delimiter: delimiter,
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const criticalErrors = results.errors.filter(
              (e) => e.code !== "TooManyFields" && e.code !== "TooFewFields"
            );

            if (criticalErrors.length > 0) {
              return reject(criticalErrors[0]); // Rejeita a promessa com o erro
            }
            if (results.meta.fields) {
              if (results.meta.fields.length < 2) {
                return reject(
                  new Error(
                    "O arquivo precisa ter pelo menos duas colunas: uma para a frente e uma para o verso do cartão."
                  )
                );
              }
              resolve(results); // Resolve a promessa com os resultados
            } else {
              return reject(
                new Error(
                  "Não foi possível encontrar o cabeçalho do arquivo. Verifique o formato e o separador."
                )
              );
            }
          },
          error: (err) => {
            reject(err); // Rejeita em caso de erro do PapaParse
          },
        });
      });
    },
    onSuccess: (results) => {
      // A lógica do 'complete' do PapaParse vem para cá
      setHeaders(results.meta.fields);
      const initialMappings = {};
      results.meta.fields.forEach((field) => {
        initialMappings[field] = "ignore";
        const lowerField = field.toLowerCase();
        if (lowerField.includes("frente") || lowerField.includes("pergunta"))
          initialMappings[field] = "front_content";
        if (lowerField.includes("verso") || lowerField.includes("resposta"))
          initialMappings[field] = "back_content";
        if (lowerField.includes("titulo") || lowerField.includes("título"))
          initialMappings[field] = "title";
        if (lowerField.includes("teoria"))
          initialMappings[field] = "theory_notes";
        if (lowerField.includes("fonte") || lowerField.includes("source"))
          initialMappings[field] = "source_references";
        if (lowerField.includes("tag")) initialMappings[field] = "tags";
      });
      setMappings(initialMappings);
      fullCsvData.current = results.data;
      setStep(2);
    },
    onError: (error) => {
      // A lógica do 'error' do PapaParse ou dos erros personalizados vem para cá
      const message = error.message || "Falha ao processar o arquivo.";
      toast.error(
        error.row ? `Erro na linha ${error.row}: ${message}` : message
      );
    },
  });

  const handleFileChange = (e) => {
    // ... (função inalterada)
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setStep(1);
    setHeaders([]);
  };

  const handleAnalyzeAndMap = () => {
    if (!file) return;
    analyzeMutation.mutate(file); // Chama a mutação
  };

  // --- 5. Criar a Mutação de Importação ---
  const importMutation = useMutation({
    mutationFn: (cardsToInsert) => {
      return supabase.from("cards").insert(cardsToInsert);
    },
    onSuccess: (result, cardsToInsert) => {
      if (result.error) throw result.error; // Lança o erro se o Supabase o retornar no objeto de sucesso

      toast.success(`${cardsToInsert.length} cartões importados com sucesso!`);

      // <<< 6. Invalidar os caches relevantes >>>
      queryClient.invalidateQueries({ queryKey: ["cards", deckId] });
      queryClient.invalidateQueries({
        queryKey: ["cardStats", deckId, userId],
      });

      navigate(`/deck/${deckId}`);
    },
    onError: (error) => {
      toast.error(`Ocorreu um erro ao salvar os cartões: ${error.message}`);
    },
  });

  const handleFinalImport = async () => {
    if (fullCsvData.current.length === 0 || !session) return;

    const mappedFields = Object.values(mappings);
    if (
      !mappedFields.includes("front_content") ||
      !mappedFields.includes("back_content")
    ) {
      toast.error(
        "Você precisa mapear as colunas para 'Frente (Pergunta)' e 'Verso (Resposta)'."
      );
      return;
    }

    const cardsToInsert = fullCsvData.current
      .map((row) => {
        const newCard = { deck_id: deckId, user_id: session.user.id };
        for (const header of headers) {
          const targetField = mappings[header];
          if (targetField !== "ignore") {
            const value = row[header];
            if (targetField === "tags" || targetField === "source_references") {
              newCard[targetField] = value
                ? value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s)
                : [];
            } else if (targetField === "title") {
              newCard[targetField] =
                value && value.trim() ? value.trim() : null;
            } else {
              newCard[targetField] = value || null;
            }
          }
        }
        if (!newCard.front_content || !newCard.back_content) {
          return null;
        }
        return newCard;
      })
      .filter((card) => card !== null);

    if (cardsToInsert.length === 0) {
      toast.error(
        "Nenhum cartão válido para importar. Verifique o mapeamento e se as colunas de Frente e Verso têm conteúdo."
      );
      return;
    }

    importMutation.mutate(cardsToInsert); // Chama a mutação
  };

  // --- 7. Estados de Loading derivados das Mutações ---
  const isAnalyzing = analyzeMutation.isPending;
  const isImporting = importMutation.isPending;

  const usedFields = useMemo(
    () => new Set(Object.values(mappings)),
    [mappings]
  );

  const getAvailableFields = (currentField) => {
    return TARGET_FIELDS.filter(
      (field) =>
        field.value === "ignore" ||
        field.value === currentField ||
        !usedFields.has(field.value)
    );
  };

  // --- 8. Atualizar o JSX com os novos estados de loading ---
  return (
    <div className="min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Importar Cartões</h1>
      </header>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Passo 1: Selecione o Arquivo e o Separador
            </h2>
            <div className="mb-4">
              <label
                htmlFor="csv-upload"
                className={`cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 inline-block ${
                  isAnalyzing ? "opacity-50 cursor-not-allowed" : ""
                }`} // <<< Usa 'isAnalyzing'
              >
                Escolher Arquivo (.csv ou .txt)
              </label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
                disabled={isAnalyzing} // <<< Usa 'isAnalyzing'
              />
              {fileName && (
                <span className="ml-4 font-semibold">{fileName}</span>
              )}
            </div>

            {file && (
              <div className="my-6 border-t border-b py-6 dark:border-gray-700">
                <h3 className="font-semibold mb-3">
                  Qual separador seu arquivo utiliza?
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {DELIMITERS.map((d) => (
                    <label
                      key={d.value || "auto"}
                      className={`flex items-center space-x-2 ${
                        isAnalyzing
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer"
                      }`} // <<< Usa 'isAnalyzing'
                    >
                      <input
                        type="radio"
                        name="delimiter"
                        value={d.value}
                        checked={delimiter === d.value}
                        onChange={(e) => setDelimiter(e.target.value)}
                        disabled={isAnalyzing} // <<< Usa 'isAnalyzing'
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleAnalyzeAndMap}
                  disabled={isAnalyzing} // <<< Usa 'isAnalyzing'
                  className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? "Analisando..." : "Analisar e Mapear Colunas"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Passo 2: Mapeie as Colunas
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Associe cada coluna do seu arquivo a um campo do CogniCard.{" "}
              <strong className="text-red-500">
                As colunas de Frente e Verso são obrigatórias.
              </strong>
            </p>
            <div className="space-y-4 mb-6">
              {headers.map((header) => {
                const availableFields = getAvailableFields(mappings[header]);
                return (
                  <div
                    key={header}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-b pb-4 dark:border-gray-700"
                  >
                    <span className="font-bold truncate" title={header}>
                      {header}
                    </span>
                    <select
                      value={mappings[header] || "ignore"}
                      onChange={(e) =>
                        setMappings((prev) => ({
                          ...prev,
                          [header]: e.target.value,
                        }))
                      }
                      disabled={isImporting} // <<< Usa 'isImporting'
                      className="w-full px-3 py-2 border rounded-md bg-gray-200 text-black dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {availableFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(1)}
                disabled={isImporting} // <<< Usa 'isImporting'
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={handleFinalImport}
                disabled={isImporting} // <<< Usa 'isImporting'
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isImporting ? "A importar..." : `Finalizar Importação`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportPage;
