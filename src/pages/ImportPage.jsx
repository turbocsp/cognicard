import { useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { supabase } from "@/supabaseClient";
import { useAuth } from "@/AuthContext";
import { toast } from "react-hot-toast";

const TARGET_FIELDS = [
  // <<< ATUALIZADO
  { value: "ignore", label: "Ignorar esta coluna" },
  { value: "title", label: "Título do Cartão" },
  { value: "front_content", label: "Frente (Pergunta)" },
  { value: "back_content", label: "Verso (Resposta)" },
  { value: "theory_notes", label: "Teoria" },
  { value: "source_references", label: "Fontes (separadas por vírgula)" },
  { value: "tags", label: "Tags (separadas por vírgula)" },
];

const DELIMITERS = [
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
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [delimiter, setDelimiter] = useState("");
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1);
  const fullCsvData = useRef([]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setStep(1);
    setHeaders([]);
  };

  const handleAnalyzeAndMap = useCallback(() => {
    if (!file) return;
    setIsProcessing(true);

    Papa.parse(file, {
      delimiter: delimiter,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsProcessing(false);
        const criticalErrors = results.errors.filter(
          (e) => e.code !== "TooManyFields" && e.code !== "TooFewFields"
        );

        if (criticalErrors.length > 0) {
          const firstError = criticalErrors[0];
          toast.error(
            `Erro ao ler o arquivo na linha ${firstError.row}: ${firstError.message}. Tente selecionar outro separador.`
          );
          return;
        }

        if (results.meta.fields) {
          if (results.meta.fields.length < 2) {
            toast.error(
              "O arquivo precisa ter pelo menos duas colunas: uma para a frente e uma para o verso do cartão."
            );
            return;
          }
          setHeaders(results.meta.fields);
          const initialMappings = {};
          results.meta.fields.forEach((field) => {
            initialMappings[field] = "ignore"; // Default to ignore
            // Basic heuristic for auto-mapping
            const lowerField = field.toLowerCase();
            if (
              lowerField.includes("frente") ||
              lowerField.includes("pergunta")
            )
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
        } else {
          toast.error(
            "Não foi possível encontrar o cabeçalho do arquivo. Verifique o formato e o separador."
          );
        }
      },
      error: (err) => {
        setIsProcessing(false);
        toast.error(`Falha ao processar o arquivo: ${err.message}`);
      },
    });
  }, [file, delimiter]);

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

    setIsProcessing(true);

    const cardsToInsert = fullCsvData.current
      .map((row) => {
        const newCard = { deck_id: deckId, user_id: session.user.id };
        for (const header of headers) {
          const targetField = mappings[header];
          if (targetField !== "ignore") {
            const value = row[header];
            if (targetField === "tags" || targetField === "source_references") {
              // Handle comma-separated values for tags and sources
              newCard[targetField] = value
                ? value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s)
                : [];
            } else if (targetField === "title") {
              // Handle title, ensure it's null if empty/whitespace
              newCard[targetField] =
                value && value.trim() ? value.trim() : null;
            } else {
              // Handle front_content, back_content, theory_notes
              newCard[targetField] = value || null; // Use null if value is empty/undefined
            }
          }
        }
        // Ensure essential fields are present
        if (!newCard.front_content || !newCard.back_content) {
          return null; // Skip card if front or back is missing
        }
        return newCard;
      })
      .filter((card) => card !== null); // Filter out invalid cards

    if (cardsToInsert.length === 0) {
      toast.error(
        "Nenhum cartão válido para importar. Verifique o mapeamento e se as colunas de Frente e Verso têm conteúdo."
      );
      setIsProcessing(false);
      return;
    }

    try {
      const { error } = await supabase.from("cards").insert(cardsToInsert);

      if (error) {
        throw error;
      }

      toast.success(`${cardsToInsert.length} cartões importados com sucesso!`);
      navigate(`/deck/${deckId}`);
    } catch (error) {
      toast.error(`Ocorreu um erro ao salvar os cartões: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

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
                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 inline-block"
              >
                Escolher Arquivo (.csv ou .txt)
              </label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
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
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="delimiter"
                        value={d.value}
                        checked={delimiter === d.value}
                        onChange={(e) => setDelimiter(e.target.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleAnalyzeAndMap}
                  disabled={isProcessing}
                  className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                >
                  {isProcessing ? "Analisando..." : "Analisar e Mapear Colunas"}
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
                      className="w-full px-3 py-2 border rounded-md bg-gray-200 text-black dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300"
              >
                Voltar
              </button>
              <button
                onClick={handleFinalImport}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
              >
                {isProcessing ? "Importando..." : `Finalizar Importação`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportPage;
