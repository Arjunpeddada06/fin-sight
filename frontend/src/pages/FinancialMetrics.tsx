import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, FileText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { documentFileUrl, errorMessage } from "../services/documents";
import { listFinancialDocuments, listFinancialMetrics } from "../services/financials";
import type { FinancialDocument, FinancialMetric } from "../types";

const LABELS: Record<string, string> = {
  revenue: "Revenue", cost_of_revenue: "Cost of revenue", gross_profit: "Gross profit",
  operating_expenses: "Operating expenses", operating_profit: "Operating profit",
  interest_expense: "Interest expense", profit_before_tax: "Profit before tax",
  income_tax: "Income tax", net_profit: "Net profit", total_assets: "Total assets",
  current_assets: "Current assets", total_liabilities: "Total liabilities",
  current_liabilities: "Current liabilities", total_equity: "Total equity",
  cash_and_equivalents: "Cash & equivalents", operating_cash_flow: "Operating cash flow",
  investing_cash_flow: "Investing cash flow", financing_cash_flow: "Financing cash flow",
};

const formatValue = (value: number, currency: string | null) =>
  `${currency ? `${currency} ` : ""}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;

export default function FinancialMetrics() {
  const [documents, setDocuments] = useState<FinancialDocument[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [metrics, setMetrics] = useState<FinancialMetric[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listFinancialDocuments().then((items) => {
      setDocuments(items);
      setDocumentId(items[0]?.id ?? "");
    }).catch((e: unknown) => setError(errorMessage(e))).finally(() => setLoadingDocs(false));
  }, []);

  useEffect(() => {
    if (!documentId) {
      setMetrics([]);
      return;
    }
    let active = true;
    setMetrics([]);
    setLoadingMetrics(true);
    listFinancialMetrics(documentId).then((items) => {
      if (active) {
        setMetrics(items);
        setError("");
      }
    }).catch((e: unknown) => {
      if (active) setError(errorMessage(e));
    }).finally(() => {
      if (active) setLoadingMetrics(false);
    });
    return () => { active = false; };
  }, [documentId]);

  const selectedDoc = documents.find((document) => document.id === documentId);
  const highlights = useMemo(() => {
    const desired = ["revenue", "gross_profit", "operating_profit", "net_profit", "total_assets", "total_liabilities"];
    return desired.map((name) => metrics.find((metric) => metric.metric_name === name)).filter((metric): metric is FinancialMetric => Boolean(metric));
  }, [metrics]);

  const chartData = useMemo(() => {
    const periods = [...new Set(metrics.map((metric) => metric.period))];
    return periods.map((period) => {
      const row: Record<string, number | string> = { period };
      metrics.filter((metric) => metric.period === period).forEach((metric) => { row[metric.metric_name] = metric.value; });
      return row;
    }).filter((row) => Object.keys(row).length > 1);
  }, [metrics]);

  const pageState = loadingDocs ? "Loading available reports…" : !documents.length
    ? "No processed reports are available yet. Upload a PDF and wait for it to finish processing."
    : !metrics.length ? "No structured financial metrics were extracted from this report. Source text and tables are still available in Documents and the AI Analyst." : "";

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Financial intelligence</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Financial insights</h1><p className="mt-1.5 text-sm text-muted">Explore values extracted directly from report tables, with source-page references.</p></div>
        <label className="min-w-[16rem]"><span className="mb-1.5 block text-xs font-medium text-muted">Report</span><select value={documentId} onChange={(event) => setDocumentId(event.target.value)} disabled={loadingDocs || documents.length === 0} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm disabled:opacity-60">
          {!documents.length && <option value="">No processed reports</option>}
          {documents.map((document) => <option key={document.id} value={document.id}>{document.company ? `${document.company} — ` : ""}{document.fiscal_year ? `${document.fiscal_year} · ` : ""}{document.filename}</option>)}
        </select></label>
      </div>
      {error && <div role="alert" className="rounded-lg border border-loss/30 bg-loss/5 px-4 py-3 text-sm text-loss">{error}</div>}
      {loadingMetrics ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy>{[1, 2, 3].map((n) => <div key={n} className="h-28 animate-pulse rounded-xl bg-surface" />)}</div>
        : pageState ? <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center"><FileText className="mx-auto size-9 text-muted" /><h2 className="mt-3 font-semibold">{documents.length ? "No financial metrics available" : "No report data available"}</h2><p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-muted">{pageState}</p></div>
          : <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Extracted financial highlights">
              {highlights.map((metric) => <article key={metric.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-2"><div className="text-xs font-medium text-muted">{LABELS[metric.metric_name] ?? metric.metric_name}</div><span className="rounded-lg bg-brand-soft p-2 text-brand"><BarChart3 className="size-4" /></span></div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">{formatValue(metric.value, metric.currency)}</div><div className="mt-1 text-[11px] text-muted">{metric.period}{metric.page_number ? ` · PDF page ${metric.page_number}` : ""}</div>
              </article>)}
            </section>

            <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Reported financial trends</h2><p className="mt-0.5 text-xs text-muted">Values are grouped by the periods detected in this report.</p></div><div className="text-xs text-muted">{selectedDoc?.company ?? selectedDoc?.filename}</div></div>
              {chartData.length === 0 ? <p className="mt-5 rounded-lg bg-paper p-6 text-center text-sm text-muted">No period-based values are available for a trend chart.</p>
                : <div className="mt-5 h-80 min-w-0">
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} tickFormatter={(value: number) => new Intl.NumberFormat("en", { notation: "compact" }).format(value)} />
                    <Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: 10, fontSize: 12 }} formatter={(value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value))} />
                    <Legend /><Bar dataKey="revenue" name="Revenue" fill="#3157d5" radius={[4, 4, 0, 0]} /><Bar dataKey="gross_profit" name="Gross profit" fill="#55a899" radius={[4, 4, 0, 0]} /><Bar dataKey="net_profit" name="Net profit" fill="#e1a34b" radius={[4, 4, 0, 0]} />
                  </BarChart></ResponsiveContainer>
                </div>}
            </section>

            <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              <div className="border-b border-line px-5 py-4"><h2 className="font-semibold">Extracted metric details</h2><p className="mt-0.5 text-xs text-muted">Original values detected in the report. Missing metrics are not estimated.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-paper text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-5 py-3 font-medium">Metric</th><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 text-right font-medium">Value</th><th className="px-4 py-3 font-medium">Source</th></tr></thead>
                <tbody className="divide-y divide-line">{metrics.map((metric) => <tr key={metric.id} className="hover:bg-paper/60"><td className="px-5 py-3 font-medium">{LABELS[metric.metric_name] ?? metric.metric_name}</td><td className="px-4 py-3 text-muted">{metric.period}</td><td className="px-4 py-3 text-right font-medium">{formatValue(metric.value, metric.currency)}</td><td className="px-4 py-3">{metric.page_number ? <a href={documentFileUrl(metric.document_id, metric.page_number)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">PDF page {metric.page_number}<ArrowUpRight className="size-3" /></a> : <span className="text-xs text-muted">Page unavailable</span>}</td></tr>)}</tbody>
              </table></div>
            </section>
          </>}
    </div>
  );
}
