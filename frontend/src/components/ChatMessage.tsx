import { Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { documentFileUrl } from "../services/documents";
import type { ChatTurn } from "../types";
import { useToast } from "./Toast";

/** The model cites as [S1]; readers see [1]. */
const display = (text: string) => text.replace(/\[S(\d+)\]/g, "[$1]");
const linkedCitations = (text: string) => text.replace(/\[S(\d+)\]/g, "[$1](#source-$1)");

export default function ChatMessage({ turn }: { turn: ChatTurn }) {
  const toast = useToast();

  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white">{turn.content}</p>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(display(turn.content));
      toast("success", "Answer copied.");
    } catch {
      toast("error", "Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="max-w-[92%]">
      {turn.tool_used && <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Tool:{turn.tool_used.replace(/_/g, " ")}</div>}
      <div className={`rounded-2xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed ${turn.refused ? "border-amber-200 bg-amber-50" : "border-line bg-surface"}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: (props) => <p className="mb-2 last:mb-0" {...props} />,
            ul: (props) => <ul className="mb-2 list-disc pl-5" {...props} />,
            ol: (props) => <ol className="mb-2 list-decimal pl-5" {...props} />,
            a: ({ href, children, ...props }) => <a href={href} className="font-medium text-brand underline underline-offset-2" {...props}>{children}</a>,
            table: (props) => <div className="my-2 overflow-x-auto"><table className="min-w-full border-collapse text-sm" {...props} /></div>,
            th: (props) => <th className="border border-line bg-paper px-3 py-1.5 text-left font-medium" {...props} />,
            td: (props) => <td className="border border-line px-3 py-1.5 tabular-nums" {...props} />,
          }}
        >
          {linkedCitations(turn.content)}
        </ReactMarkdown>

        {turn.sources && turn.sources.length > 0 && (
          <div className="mt-3 border-t border-line pt-2">
            <div className="text-xs font-medium text-muted">Sources</div>
            <ul className="mt-2 space-y-2">
              {turn.sources.map((s) => (
                <li key={s.label} id={`source-${s.label}`} className="rounded-lg bg-paper p-3 text-xs">
                  <a href={documentFileUrl(s.document_id, s.page_number)} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                    [{s.label}] {s.document_name}, page {s.page_number}
                  </a>
                  {s.section && <div className="mt-0.5 text-muted">{s.section}</div>}
                  {s.snippet && <p className="mt-2 line-clamp-4 leading-relaxed text-ink/80">{s.snippet}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <button onClick={copy} className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink" aria-label="Copy answer">
        <Copy className="size-3" aria-hidden /> Copy
      </button>
    </div>
  );
}
