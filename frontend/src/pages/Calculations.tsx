import { useEffect, useState, type FormEvent } from "react";
import { Calculator, Check, LoaderCircle } from "lucide-react";
import { calculateMetric, listCalculationMetrics } from "../services/calculations";
import { errorMessage } from "../services/documents";
import type { CalculationMetric, CalculationResult } from "../types";

export default function Calculations() {
  const [metrics, setMetrics] = useState<CalculationMetric[]>([]);
  const [metricName, setMetricName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listCalculationMetrics().then((items) => {
      setMetrics(items);
      setMetricName(items[0]?.metric ?? "");
    }).catch((e: unknown) => setError(errorMessage(e))).finally(() => setLoading(false));
  }, []);

  const selected = metrics.find((item) => item.metric === metricName);

  function chooseMetric(name: string) {
    setMetricName(name);
    setValues({});
    setResult(null);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const parsed: Record<string, number> = {};
    for (const param of selected.params) {
      const value = Number(values[param]);
      if (values[param]?.trim() === "" || !Number.isFinite(value)) {
        setError(`Enter a valid number for ${param.replace(/_/g, " ")}.`);
        return;
      }
      parsed[param] = value;
    }
    setCalculating(true);
    setError("");
    try {
      setResult(await calculateMetric(metricName, parsed));
    } catch (e) {
      setResult(null);
      setError(errorMessage(e));
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><Calculator className="size-5" /></div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Financial calculations</h1>
        <p className="mt-1 text-sm text-muted">Run deterministic financial calculations using the supported backend formulas.</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-loss/30 bg-loss/5 px-4 py-3 text-sm text-loss">{error}</div>}
      {loading ? <div className="h-52 animate-pulse rounded-xl bg-surface" aria-busy />
        : metrics.length === 0 ? <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">The calculation service did not return any supported calculations.</div>
          : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
            <form onSubmit={submit} className="space-y-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
              <div>
                <label htmlFor="calculation" className="mb-2 block text-sm font-medium">Calculation</label>
                <select id="calculation" value={metricName} onChange={(event) => chooseMetric(event.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm">
                  {metrics.map((metric) => <option key={metric.metric} value={metric.metric}>{metric.label}</option>)}
                </select>
                {selected && <p className="mt-2 text-xs text-muted">{selected.description}</p>}
              </div>
              {selected?.params.map((param) => (
                <div key={param}>
                  <label htmlFor={param} className="mb-1.5 block text-sm font-medium capitalize">{param.replace(/_/g, " ")}</label>
                  <input id={param} type="number" step="any" value={values[param] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [param]: event.target.value }))} className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm" placeholder="Enter value" required />
                </div>
              ))}
              <div className="rounded-lg bg-paper p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Formula</div><div className="mt-1 text-sm font-medium">{selected?.description ?? "Loading formula…"}</div></div>
              <button type="submit" disabled={!selected || calculating} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                {calculating ? <LoaderCircle className="size-4 animate-spin" /> : <Calculator className="size-4" />}
                {calculating ? "Calculating…" : "Calculate"}
              </button>
            </form>

            <section aria-live="polite" className="min-h-72 rounded-xl border border-line bg-surface p-5 shadow-sm">
              {result ? <>
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-sm font-medium text-muted">{result.label}</div><div className="mt-2 text-4xl font-semibold tracking-tight text-brand">{result.display}</div></div>
                  <span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check className="size-5" /></span>
                </div>
                <div className="mt-6 border-t border-line pt-4"><h2 className="text-sm font-semibold">Calculation breakdown</h2><ol className="mt-3 space-y-3">{result.steps.map((step, index) => <li key={`${step}-${index}`} className="flex gap-3 text-sm text-muted"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-paper text-[10px] font-semibold">{index + 1}</span><span>{step}</span></li>)}</ol></div>
                {result.notes.length > 0 && <div className="mt-5 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{result.notes.join(" ")}</div>}
              </> : <div className="grid min-h-60 place-items-center text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-paper text-muted"><Calculator className="size-5" /></span><h2 className="mt-3 text-sm font-semibold">Your result will appear here</h2><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">Choose a calculation and enter the required values. All math is performed by the financial calculation API.</p></div></div>}
            </section>
          </div>}
    </div>
  );
}
