import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, MessageSquarePlus, Plus, Search, Send, Trash2 } from "lucide-react";
import ChatMessage from "../components/ChatMessage";
import { useToast } from "../components/Toast";
import { useDocuments } from "../hooks/useDocuments";
import { deleteConversation, getConversation, listConversations, sendChat } from "../services/chat";
import { errorMessage } from "../services/documents";
import type { ChatTurn, ConversationSummary } from "../types";

const SUGGESTED = [
  "What is the company's total revenue?",
  "What was the net profit for FY2025?",
  "Calculate the net profit margin.",
  "Identify major financial risks.",
  "Summarize the annual financial performance.",
];

export default function Analyst() {
  const { documents, loading: docsLoading } = useDocuments();
  const [params, setParams] = useSearchParams();
  const conversationParam = params.get("conversation");
  const documentParam = params.get("document");
  const selectedDocument = documents.find((document) => document.id === documentParam);
  const readyCount = documents.filter((document) => document.status === "ready").length;
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    listConversations().then(setHistory).catch((error: unknown) => setHistoryError(errorMessage(error)));
  }, []);

  useEffect(() => {
    if (!conversationParam) {
      setConversationId(undefined);
      setTurns([]);
      return;
    }
    let active = true;
    setLoadingConversation(true);
    getConversation(conversationParam).then((conversation) => {
      if (!active) return;
      setConversationId(conversation.id);
      setTurns(conversation.messages.map(({ id, role, content, sources }) => ({ id, role, content, sources })));
    }).catch((error: unknown) => {
      if (active) toast("error", errorMessage(error));
    }).finally(() => {
      if (active) setLoadingConversation(false);
    });
    return () => { active = false; };
  }, [conversationParam, toast]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (message.length < 2 || sending) return;
    setInput("");
    setSending(true);
    setTurns((current) => [...current, { id: crypto.randomUUID(), role: "user", content: message }]);
    try {
      const response = await sendChat(message, conversationId, documentParam ? [documentParam] : undefined);
      setConversationId(response.conversation_id);
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("conversation", response.conversation_id);
        return next;
      }, { replace: true });
      setTurns((current) => [...current, { id: response.message_id, role: "assistant", content: response.answer, sources: response.sources, refused: response.refused, tool_used: response.tool_used }]);
      listConversations().then(setHistory).catch((error: unknown) => setHistoryError(errorMessage(error)));
    } catch (error) {
      const messageText = errorMessage(error);
      toast("error", messageText);
      setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: `Sorry, I couldn't answer that. ${messageText}`, refused: true }]);
    } finally {
      setSending(false);
    }
  }

  function newChat() {
    setTurns([]);
    setConversationId(undefined);
    setInput("");
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("conversation");
      return next;
    }, { replace: true });
  }

  async function removeConversation(event: MouseEvent, item: ConversationSummary) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(`Delete “${item.title || "Untitled conversation"}”?`)) return;
    try {
      await deleteConversation(item.id);
      setHistory((current) => current.filter((entry) => entry.id !== item.id));
      if (item.id === conversationId) newChat();
    } catch (error) {
      toast("error", errorMessage(error));
    }
  }

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  };
  const filteredHistory = history.filter((item) => (item.title ?? "").toLowerCase().includes(historyQuery.toLowerCase()));

  return (
    <div className="mx-auto grid h-[calc(100vh-7.5rem)] max-w-[1440px] min-h-[36rem] gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm lg:flex">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div><h2 className="text-sm font-semibold">Conversations</h2><p className="mt-0.5 text-[11px] text-muted">{history.length} saved sessions</p></div>
          <button onClick={newChat} aria-label="Start a new conversation" className="rounded-lg bg-brand-soft p-2 text-brand transition hover:opacity-80"><MessageSquarePlus className="size-4" /></button>
        </div>
        <label className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-paper px-2.5 py-2"><Search className="size-3.5 text-muted" /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search conversations" className="w-full bg-transparent text-xs outline-none" /></label>
        {historyError && <p className="px-4 pt-3 text-xs text-loss">{historyError}</p>}
        <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {filteredHistory.map((item) => (
            <div key={item.id} className={`group flex items-start gap-1 rounded-lg px-2.5 py-2.5 ${conversationId === item.id ? "bg-brand-soft text-brand" : "text-ink hover:bg-paper"}`}>
              <Link to={`/analyst?conversation=${encodeURIComponent(item.id)}`} className="flex min-w-0 flex-1 items-start gap-2">
                <MessageSquarePlus className="mt-0.5 size-3.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{item.title || "Untitled conversation"}</span><span className="mt-1 block text-[10px] text-muted">{new Date(item.created_at).toLocaleDateString()} · {item.message_count} messages</span></span>
              </Link>
              <button onClick={(event) => removeConversation(event, item)} aria-label={`Delete ${item.title || "conversation"}`} className="rounded p-1 text-muted opacity-0 hover:bg-loss/10 hover:text-loss group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
          {!historyError && history.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted">Your saved conversations will appear here.</p>}
          {history.length > 0 && filteredHistory.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted">No conversations match.</p>}
        </div>
        <Link to="/history" className="border-t border-line px-4 py-3 text-xs font-medium text-brand hover:bg-paper">View chat history</Link>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 md:px-6">
          <div><div className="text-xs font-semibold uppercase tracking-[0.13em] text-brand">Financial research</div><h1 className="mt-1 text-lg font-semibold tracking-tight">AI Financial Analyst</h1><p className="mt-1 text-xs text-muted">{selectedDocument ? `Questions are scoped to ${selectedDocument.title ?? selectedDocument.filename}.` : "Answers are grounded in your reports and include source pages."}</p></div>
          <button onClick={newChat} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium transition hover:bg-paper"><Plus className="size-3.5" />New chat</button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-paper/50 p-4 md:p-6" aria-live="polite">
          {loadingConversation && <div className="flex items-center gap-2 text-sm text-muted" role="status"><Loader2 className="size-4 animate-spin" />Loading conversation…</div>}
          {turns.length === 0 && !loadingConversation && (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand text-white shadow-md shadow-brand/20"><MessageSquarePlus className="size-6" /></div>
              <h2 className="mt-4 text-center text-xl font-semibold tracking-tight">Your financial research copilot</h2>
              {!docsLoading && readyCount === 0 ? <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted">Process a report before asking questions. <Link to="/documents" className="font-medium text-brand underline underline-offset-2">Upload a financial report</Link>.</p>
                : <><p className="mx-auto mt-2 max-w-md text-center text-sm text-muted">Ask a question about your uploaded financial reports. Every answer is supported by retrieved source pages.</p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">{SUGGESTED.map((question) => <button key={question} onClick={() => send(question)} disabled={readyCount === 0} className="rounded-xl border border-line bg-surface p-3 text-left text-xs leading-relaxed transition hover:border-brand/40 hover:shadow-sm disabled:opacity-50">{question}</button>)}</div></>}
            </div>
          )}
          {turns.map((turn) => <ChatMessage key={turn.id} turn={turn} />)}
          {sending && <div className="flex items-center gap-2 text-sm text-muted" role="status"><Loader2 className="size-4 animate-spin" />Searching your reports…</div>}
          <div ref={bottom} />
        </div>

        <div className="border-t border-line bg-surface p-3 md:p-4">
          <div className="flex items-end gap-2 rounded-xl border border-line bg-paper p-2 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/10">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKey} rows={2} maxLength={2000} disabled={readyCount === 0 || sending} aria-label="Your question" placeholder={readyCount === 0 ? "Upload and process a report to get started" : "Ask about revenue, profit, debt, risks…"}
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted disabled:opacity-60" />
            <button onClick={() => send(input)} disabled={sending || input.trim().length < 2 || readyCount === 0} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-white transition hover:opacity-90 disabled:opacity-40"><Send className="size-4" /></button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted">Enter to send · Shift + Enter for a new line · Research support only, not investment advice.</p>
        </div>
      </section>
    </div>
  );
}
