import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, MessageSquareText, Search, Trash2 } from "lucide-react";
import { deleteConversation, listConversations } from "../services/chat";
import { errorMessage } from "../services/documents";
import type { ConversationSummary } from "../types";

export default function ChatHistory() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setItems(await listConversations());
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function remove(item: ConversationSummary) {
    if (!window.confirm(`Delete “${item.title || "Untitled conversation"}”?`)) return;
    try {
      await deleteConversation(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const filtered = useMemo(() => items.filter((item) => (item.title ?? "").toLowerCase().includes(query.toLowerCase())), [items, query]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Conversations</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Chat history</h1><p className="mt-1.5 text-sm text-muted">Continue a conversation or manage previous research sessions.</p></div><Link to="/analyst" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">New conversation</Link></div>
      <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5"><Search className="size-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a conversation…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      {error && <div role="alert" className="rounded-lg border border-loss/30 bg-loss/5 px-4 py-3 text-sm text-loss">{error}</div>}
      {loading ? <div className="space-y-3" aria-busy>{[1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-surface" />)}</div>
        : filtered.length === 0 ? <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center"><MessageSquareText className="mx-auto size-8 text-muted" /><h2 className="mt-3 font-semibold">{items.length ? "No conversations match" : "No conversations yet"}</h2><p className="mt-1 text-sm text-muted">{items.length ? "Try another search term." : "Your saved AI Analyst conversations will appear here."}</p></div>
          : <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">{filtered.map((item) => (
            <div key={item.id} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 md:px-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><MessageSquareText className="size-[18px]" /></span>
              <Link to={`/analyst?conversation=${encodeURIComponent(item.id)}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium hover:text-brand">{item.title || "Untitled conversation"}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"><span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{new Date(item.created_at).toLocaleString()}</span><span>{item.message_count} messages</span></span>
              </Link>
              <button onClick={() => remove(item)} aria-label={`Delete ${item.title || "conversation"}`} className="rounded-lg p-2 text-muted hover:bg-loss/10 hover:text-loss"><Trash2 className="size-4" /></button>
            </div>
          ))}</div>}
    </div>
  );
}
