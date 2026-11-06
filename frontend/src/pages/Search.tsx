import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, FileSearch, Search as SearchIcon } from "lucide-react";
import { documentFileUrl, errorMessage } from "../services/documents";
import { searchDocuments } from "../services/search";
import type { SearchHit } from "../types";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(value: string) {
    const normalized = value.trim();
    if (normalized.length < 2) return;
    setQuery(normalized);
    setParams({ q: normalized });
    setLoading(true);
    setError("");
    try {
      setHits((await searchDocuments(normalized)).hits);
    } catch (e) {
      setHits(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = params.get("q");
    if (initial) run(initial);
  // Query parameters are the initial search request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    run(query);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Research workspace</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Search &amp; research</h1><p className="mt-1.5 text-sm text-muted">Find relevant passages in your uploaded financial reports, with source pages.</p></div>
      <form onSubmit={submit} className="flex gap-2 rounded-xl border border-line bg-surface p-2 shadow-sm">
        <SearchIcon className="ml-2 mt-2.5 size-5 shrink-0 text-muted" />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search revenue, cash flow, risks…" aria-label="Search uploaded financial reports" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" />
        <button type="submit" disabled={loading || query.trim().length < 2} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? "Searching…" : "Search"}</button>
      </form>
      {error && <div role="alert" className="rounded-lg border border-loss/30 bg-loss/5 px-4 py-3 text-sm text-loss">{error}</div>}
      {hits && <div className="flex items-center justify-between text-sm"><h2 className="font-semibold">{hits.length ? `${hits.length} relevant ${hits.length === 1 ? "passage" : "passages"}` : "No matching information found"}</h2><span className="text-xs text-muted">Query: “{query}”</span></div>}
      {hits?.length === 0 && <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center"><FileSearch className="mx-auto size-9 text-muted" /><h2 className="mt-3 font-semibold">Try another search</h2><p className="mt-1 text-sm text-muted">No relevant passages were found in the reports currently available.</p></div>}
      {hits && hits.length > 0 && <ol className="space-y-3">{hits.map((hit) => (
        <li key={hit.chunk_id} className="rounded-xl border border-line bg-surface p-5 shadow-sm transition hover:border-brand/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><a href={documentFileUrl(hit.document_id, hit.page_number)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">{hit.document_name}<ArrowUpRight className="size-3.5" /></a><div className="mt-1 text-xs text-muted">{hit.section ? `${hit.section} · ` : ""}Page {hit.page_number} · {hit.kind === "table" ? "Extracted table" : "Report text"}</div></div>
            <div className="rounded-full bg-paper px-2.5 py-1 text-[10px] text-muted">{hit.matched_by.join(" + ") || "Relevant match"}</div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/90">{hit.content}</p>
        </li>
      ))}</ol>}
      {!hits && !error && !loading && <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center"><SearchIcon className="mx-auto size-8 text-muted" /><h2 className="mt-3 font-semibold">Search across your reports</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted">Enter a question or phrase to retrieve the most relevant extracted passages and PDF page references.</p></div>}
    </div>
  );
}
