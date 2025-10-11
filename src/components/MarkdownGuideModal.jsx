import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Conteúdo do guia de formatação
const markdownGuide = `
# Guia Rápido de Formatação Markdown (GFM)

Você pode usar as seguintes sintaxes para formatar o conteúdo dos seus cartões.

---

### 1. Ênfase no Texto
- **Negrito:** \`**Texto em negrito**\` → **Texto em negrito**
- *Itálico:* \`*Texto em itálico*\` → *Texto em itálico*
- ~~Tachado:~~ \`~~Texto tachado~~\` → ~~Texto tachado~~

---

### 2. Títulos
Use o caractere \`#\` para criar títulos.
\`\`\`
# Título 1
## Título 2
### Título 3
\`\`\`

---

### 3. Listas
- **Não Ordenadas:**
  \`\`\`
  * Item 1
  * Item 2
  \`\`\`
- **Ordenadas:**
  \`\`\`
  1. Primeiro item
  2. Segundo item
  \`\`\`
- **Tarefas:**
  \`\`\`
  - [x] Tarefa concluída
  - [ ] Tarefa pendente
  \`\`\`

---

### 4. Links
\`[Texto do Link](https://exemplo.com)\` → [Texto do Link](https://exemplo.com)

---

### 5. Citações
\`> Isso é uma citação.\`
> Isso é uma citação.

---

### 6. Código
- **Inline:** Use crases para \`código inline\`.
- **Bloco de Código:**
  \`\`\`javascript
  function hello() {
    console.log("Olá, mundo!");
  }
  \`\`\`

---

### 7. Tabelas
\`\`\`
| Cabeçalho 1 | Cabeçalho 2 |
| ----------- | ----------- |
| Célula 1    | Célula 2    |
\`\`\`

---

### 8. Linha Horizontal
Use três hífens para criar uma linha.
\`---\`
`;

export function MarkdownGuideModal({ isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} // Impede que o clique dentro do modal o feche
      >
        <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdownGuide}
          </ReactMarkdown>
        </div>

        <div className="text-right mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
