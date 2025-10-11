import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Componente reutilizável para renderizar Markdown
export function MarkdownRenderer({ content }) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
