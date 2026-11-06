import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, RefreshCw, Trash2 } from "lucide-react";
import DocumentDetailPanel from "../components/DocumentDetailPanel";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import UploadDropzone from "../components/UploadDropzone";
import { useDocuments } from "../hooks/useDocuments";
import { deleteDocument, documentFileUrl, errorMessage, reprocessDocument } from "../services/documents";

export default function Documents() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { documents, total, loading, error, refresh } = useDocuments(page, pageSize);
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? Its extracted data will be removed too.`)) return;
    try {
      await deleteDocument(id);
      if (selected === id) setSelected(null);
      toast("success", `${title} deleted.`);
      if (page > 1 && documents.length === 1) setPage(page - 1);
      else await refresh();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  async function retry(id: string) {
    try {
      await reprocessDocument(id);
      await refresh();
      toast("success", "Document processing has started.");
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  function uploaded() {
    if (page > 1) setPage(1);
    else void refresh();
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Library</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Financial documents</h1><p className="mt-1.5 text-sm text-muted">Upload, organize, process and analyze your financial reports.</p></div>
      <UploadDropzone onUploaded={uploaded} />

      <div className={`grid items-start gap-5 ${selected ? "xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.8fr)]" : ""}`}>
        <section aria-label="Uploaded documents" className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">All documents</h2><p className="mt-0.5 text-xs text-muted">{total} report{total === 1 ? "" : "s"} in your workspace</p></div></div>
          {error && <p className="m-4 rounded-lg border border-loss/30 bg-loss/5 px-3 py-2 text-sm text-loss">Couldn’t load your documents. The list will retry automatically.</p>}
          {loading ? <div className="space-y-3 p-5" aria-busy>{[1, 2, 3].map((n) => <div key={n} className="h-14 animate-pulse rounded-lg bg-paper" />)}</div>
            : documents.length === 0 ? <div className="px-6 py-14 text-center"><FileText className="mx-auto size-9 text-muted" /><h3 className="mt-3 text-sm font-semibold">No reports uploaded yet</h3><p className="mt-1 text-xs text-muted">Upload a PDF above to start extracting and analyzing your data.</p></div>
              : <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-paper text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-5 py-3 font-medium">Document</th><th className="px-4 py-3 font-medium">Report details</th><th className="px-4 py-3 font-medium">Pages</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Uploaded</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {documents.map((document) => (
                      <tr key={document.id} className="transition hover:bg-paper/60">
                        <td className="max-w-[18rem] px-5 py-3.5"><button onClick={() => setSelected(document.id)} className="flex min-w-0 items-center gap-3 text-left"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><FileText className="size-4" /></span><span className="min-w-0"><span className="block truncate font-medium">{document.title ?? document.filename}</span><span className="mt-0.5 block truncate text-xs text-muted">{document.company ?? document.filename}</span></span></button></td>
                        <td className="px-4 py-3.5 text-xs text-muted">{[document.report_type, document.fiscal_year].filter(Boolean).join(" · ") || "Not detected"}</td>
                        <td className="px-4 py-3.5 text-xs text-muted">{document.page_count ?? "—"}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={document.status} /></td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted">{new Date(document.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5"><div className="flex items-center justify-end gap-1">
                          <button onClick={() => setSelected(document.id)} aria-label={`View ${document.title ?? document.filename} details`} title="View details" className="rounded-lg p-2 text-muted hover:bg-paper hover:text-ink"><FileText className="size-4" /></button>
                          <a href={documentFileUrl(document.id)} target="_blank" rel="noreferrer" aria-label={`Preview ${document.title ?? document.filename}`} title="Preview PDF" className="rounded-lg p-2 text-muted hover:bg-paper hover:text-brand"><ExternalLink className="size-4" /></a>
                          {(document.status === "failed" || document.status === "ready") && <button onClick={() => retry(document.id)} aria-label={`Reprocess ${document.title ?? document.filename}`} title="Process / reprocess" className="rounded-lg p-2 text-muted hover:bg-paper hover:text-brand"><RefreshCw className="size-4" /></button>}
                          <button onClick={() => remove(document.id, document.title ?? document.filename)} aria-label={`Delete ${document.title ?? document.filename}`} title="Delete document" className="rounded-lg p-2 text-muted hover:bg-loss/10 hover:text-loss"><Trash2 className="size-4" /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
          {!loading && total > pageSize && <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="text-xs text-muted">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((current) => current - 1)} disabled={page === 1} aria-label="Previous page" className="rounded-lg border border-line p-2 text-muted hover:bg-paper disabled:opacity-40"><ChevronLeft className="size-4" /></button>
              <button onClick={() => setPage((current) => current + 1)} disabled={page * pageSize >= total} aria-label="Next page" className="rounded-lg border border-line p-2 text-muted hover:bg-paper disabled:opacity-40"><ChevronRight className="size-4" /></button>
            </div>
          </div>}
        </section>
        {selected && <DocumentDetailPanel id={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
