import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Calculator, FileText,
  MessageSquareText, Plus, Search, TrendingUp,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatusBadge from "../components/StatusBadge";
import { useDocuments } from "../hooks/useDocuments";
import { listFinancialMetrics } from "../services/financials";
import { errorMessage } from "../services/documents";
import type { FinancialMetric } from "../types";

const LABELS: Record<string, string> = {
  revenue: "Revenue", net_profit: "Net income", operating_expenses: "Operating expenses",
  total_assets: "Total assets", gross_profit: "Gross profit", operating_profit: "Operating profit",
};

const money = (value: number, currency?: string | null) =>
  `${currency ? `${currency} ` : ""}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard" }).format(value)}`;

function StatCard({ label, value, note, icon: Icon, tone = "blue" }: {
  label: string; value: string; note: string; icon: typeof FileText; tone?: "blue" | "green" | "violet" | "amber";
}) {
  const toneClass = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700" }[tone];
  return (
    <article className="rounded-xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium text-muted">{label}</div>
        <span className={`grid size-9 place-items-center rounded-lg ${toneClass}`}><Icon className="size-[18px]" aria-hidden /></span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted">{note}</div>
    </article>
  );
}

export default function Dashboard() {
  const { documents, total, loading: docsLoading, error: docsError } = useDocuments();
  const [metrics, setMetrics] = useState<FinancialMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState("");

  useEffect(() => {
    listFinancialMetrics()
      .then(setMetrics)
      .catch((error: unknown) => setMetricsError(errorMessage(error)))
      .finally(() => setMetricsLoading(false));
  }, []);

  const overview = useMemo(() => {
    const priority = ["revenue", "net_profit", "operating_expenses", "total_assets"];
    return priority.map((name) => metrics.find((metric) => metric.metric_name === name)).filter((item): item is FinancialMetric => Boolean(item));
  }, [metrics]);

  const chartData = useMemo(() => {
    const periods = [...new Set(metrics.map((metric) => metric.period))];
    return periods.map((period) => {
      const row: Record<string, string | number> = { period };
      metrics.filter((metric) => metric.period === period && ["revenue", "net_profit", "operating_profit"].includes(metric.metric_name))
        .forEach((metric) => { row[metric.metric_name] = metric.value; });
      return row;
    }).filter((row) => Object.keys(row).length > 1);
  }, [metrics]);

  const processed = documents.filter((document) => document.status === "ready").length;
  return (
    <div className="mx-auto max-w-[1440px] space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Financial workspace</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-[28px]">Welcome to FinSight AI</h1>
          <p className="mt-1.5 text-sm text-muted">Your intelligent workspace for financial report analysis.</p>
        </div>
        <Link to="/documents" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90">
          <Plus className="size-4" /> Upload report
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace overview">
        <StatCard label="Total documents" value={docsLoading ? "…" : String(total)} note={docsError ? "Unable to load document count" : "Reports in your workspace"} icon={FileText} />
        <StatCard label="Processed reports" value={docsLoading ? "…" : String(processed)} note="Ready for questions and analysis" icon={TrendingUp} tone="green" />
        <StatCard label="Financial metrics" value={metricsLoading ? "…" : metricsError ? "—" : String(metrics.length)} note={metricsError ? "Metric service unavailable" : "Extracted from uploaded reports"} icon={BarChart3} tone="violet" />
        <StatCard label="AI queries" value="—" note="Query totals are not provided by the API" icon={MessageSquareText} tone="amber" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div><h2 className="font-semibold">Recent documents</h2><p className="mt-0.5 text-xs text-muted">Latest reports in your workspace</p></div>
            <Link to="/documents" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          {docsLoading ? <div className="space-y-3 p-5" aria-busy>{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-paper" />)}</div>
            : docsError ? <p className="p-5 text-sm text-loss">Couldn’t load your documents. Check the backend connection.</p>
              : documents.length === 0 ? <div className="px-5 py-10 text-center"><FileText className="mx-auto size-8 text-muted" /><p className="mt-3 text-sm font-medium">No reports uploaded yet</p><p className="mt-1 text-xs text-muted">Upload a PDF to see your financial workspace come to life.</p></div>
                : <div className="divide-y divide-line">
                  {documents.slice(0, 5).map((document) => (
                    <Link to="/documents" key={document.id} className="flex min-w-0 items-center gap-3 px-5 py-3.5 transition hover:bg-paper/70">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><FileText className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{document.title ?? document.filename}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{[document.company, document.fiscal_year, document.report_type].filter(Boolean).join(" · ") || new Date(document.created_at).toLocaleDateString()}</span>
                      </span>
                      <StatusBadge status={document.status} />
                    </Link>
                  ))}
                </div>}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div><h2 className="font-semibold">Financial overview</h2><p className="mt-0.5 text-xs text-muted">Latest extracted values across reports</p></div>
            <Link to="/metrics" aria-label="Open financial insights" className="rounded-lg border border-line p-2 text-muted hover:bg-paper"><ArrowUpRight className="size-4" /></Link>
          </div>
          {metricsLoading ? <div className="mt-5 h-40 animate-pulse rounded-lg bg-paper" aria-busy />
            : metricsError ? <p className="mt-5 rounded-lg bg-paper p-4 text-sm text-loss">{metricsError}</p>
              : overview.length === 0 ? <div className="mt-5 rounded-lg bg-paper px-4 py-8 text-center text-sm text-muted">No financial metrics have been extracted yet.</div>
                : <div className="mt-4 divide-y divide-line">
                  {overview.map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between gap-3 py-3">
                      <div><div className="text-sm font-medium">{LABELS[metric.metric_name] ?? metric.metric_name}</div><div className="mt-0.5 text-xs text-muted">{metric.company ?? metric.filename} · {metric.period}</div></div>
                      <div className="text-right text-sm font-semibold">{money(metric.value, metric.currency)}{metric.page_number ? <div className="mt-0.5 text-[10px] font-normal text-muted">Page {metric.page_number}</div> : null}</div>
                    </div>
                  ))}
                </div>}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">Financial performance</h2><p className="mt-0.5 text-xs text-muted">Reported values by fiscal period</p></div>
            <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] text-muted">Source data only</span>
          </div>
          {metricsLoading ? <div className="mt-5 h-64 animate-pulse rounded-lg bg-paper" aria-busy />
            : chartData.length === 0 ? <div className="mt-5 grid h-56 place-items-center rounded-lg bg-paper px-5 text-center text-sm text-muted">Trend charts appear when reports contain financial metrics for one or more periods.</div>
              : <div className="mt-5 h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: "var(--muted)", fontSize: 10 }} tickFormatter={(value: number) => new Intl.NumberFormat("en", { notation: "compact" }).format(value)} />
                    <Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: 10, fontSize: 12 }} formatter={(value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value))} />
                    <Bar dataKey="revenue" name="Revenue" fill="#3157d5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net_profit" name="Net income" fill="#16a36a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="operating_profit" name="Operating profit" fill="#8b78e6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>}
        </section>
        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">Quick actions</h2><p className="mt-0.5 text-xs text-muted">Continue your financial analysis</p>
          <div className="mt-4 grid gap-2.5">
            {[
              { to: "/analyst", icon: MessageSquareText, title: "Ask the AI analyst", desc: "Get cited answers from your reports" },
              { to: "/metrics", icon: BarChart3, title: "Explore financial insights", desc: "Review extracted metrics and trends" },
              { to: "/calculations", icon: Calculator, title: "Calculate financial ratios", desc: "Run explainable API-backed calculations" },
              { to: "/search", icon: Search, title: "Search your reports", desc: "Find relevant pages and passages" },
            ].map(({ to, icon: Icon, title, desc }) => (
              <Link to={to} key={to} className="group flex items-center gap-3 rounded-lg border border-line p-3 transition hover:border-brand/40 hover:bg-paper">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="mt-0.5 block truncate text-xs text-muted">{desc}</span></span>
                <ArrowRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      {metricsError && <p className="flex items-center gap-2 text-xs text-muted"><ArrowDownRight className="size-3.5" /> Some financial panels may be incomplete while the metrics service is unavailable.</p>}
    </div>
  );
}
