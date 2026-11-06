import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, BriefcaseBusiness, Calculator, ChevronLeft, ChevronRight, FileText,
  History, LayoutDashboard, Menu, MessageSquareText, Moon, Search, Settings, Sun, X,
} from "lucide-react";
import { useHealth } from "../hooks/useHealth";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/analyst", label: "AI Financial Analyst", icon: MessageSquareText },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/metrics", label: "Financial Insights", icon: BarChart3 },
  { to: "/calculations", label: "Calculations", icon: Calculator },
  { to: "/search", label: "Search & Research", icon: Search },
  { to: "/history", label: "Chat History", icon: History },
];

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/analyst": "AI Financial Analyst",
  "/documents": "Financial Documents",
  "/metrics": "Financial Insights",
  "/calculations": "Calculations",
  "/search": "Search & Research",
  "/history": "Chat History",
  "/settings": "Settings",
};

function ConnectionStatus() {
  const { health, unreachable } = useHealth();
  const ok = health?.status === "ok";
  const label = unreachable ? "API unavailable" : !health ? "Connecting…" : ok ? "Systems operational" : "Service degraded";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" role="status">
      <span className={`size-2 rounded-full ${ok ? "bg-gain" : unreachable || health ? "bg-loss" : "bg-line"}`} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("finsight-theme") === "dark");
  const [query, setQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const title = TITLES[location.pathname] ?? "FinSight AI";

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("finsight-theme", next ? "dark" : "light");
  }

  function search(event: FormEvent) {
    event.preventDefault();
    navigate(`/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
    setMobileOpen(false);
  }

  return (
    <div className={`min-h-screen md:grid ${collapsed ? "md:grid-cols-[5rem_1fr]" : "md:grid-cols-[16rem_1fr]"}`}>
      {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" />}
      <aside className={`z-40 flex flex-col bg-sidebar text-sidebar-text transition-[width,transform] duration-200 md:relative md:min-h-screen ${collapsed ? "md:w-20" : "md:w-64"} ${mobileOpen ? "fixed inset-y-0 left-0 w-72" : "fixed -translate-x-full md:sticky md:top-0 md:translate-x-0"}`}>
        <div className={`flex h-[4.5rem] items-center gap-3 border-b border-sidebar-line px-5 ${collapsed ? "md:justify-center md:px-2" : ""}`}>
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><BriefcaseBusiness className="size-5" aria-hidden /></div>
          <div className={`${collapsed ? "md:hidden" : ""}`}>
            <div className="font-semibold tracking-tight text-white">FinSight AI</div>
            <div className="text-[11px] text-slate-400">Financial intelligence</div>
          </div>
          <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white/10 md:hidden"><X className="size-4" /></button>
        </div>
        <div className={`px-3 pt-6 ${collapsed ? "md:px-2" : ""}`}>
          {!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>}
          <nav aria-label="Main navigation" className="space-y-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === "/"} title={collapsed ? label : undefined}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${isActive ? "bg-sidebar-active font-medium text-white shadow-sm" : "text-slate-300 hover:bg-white/[0.07] hover:text-white"} ${collapsed ? "md:justify-center md:px-2" : ""}`}>
                <Icon className={`size-[18px] shrink-0 ${location.pathname === to ? "text-blue-300" : "text-slate-400 group-hover:text-slate-200"}`} aria-hidden />
                <span className={collapsed ? "md:hidden" : ""}>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-auto space-y-3 border-t border-sidebar-line p-4">
          <NavLink to="/settings" title={collapsed ? "Settings" : undefined} onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${isActive ? "bg-sidebar-active text-white" : "text-slate-300 hover:bg-white/[0.07]"} ${collapsed ? "md:justify-center md:px-2" : ""}`}>
            <Settings className="size-[18px] shrink-0" /><span className={collapsed ? "md:hidden" : ""}>Settings</span>
          </NavLink>
          <div className={`flex items-center gap-3 rounded-lg bg-white/[0.06] p-2.5 ${collapsed ? "md:justify-center" : ""}`}>
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-200">FS</div>
            <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}><div className="truncate text-xs font-medium text-white">Financial workspace</div><div className="truncate text-[10px] text-slate-400">Research environment</div></div>
          </div>
          <button onClick={() => setCollapsed((value) => !value)} className="hidden w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-slate-400 hover:bg-white/[0.07] hover:text-white md:flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="size-4" /> Collapse sidebar</>}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-8">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-muted hover:bg-paper md:hidden"><Menu className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold tracking-tight">{title}</div>
            <div className="hidden text-[11px] text-muted sm:block">FinSight AI <span className="mx-1.5 text-line">/</span>{title}</div>
          </div>
          <form onSubmit={search} className="hidden w-full max-w-[19rem] items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 lg:flex">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input aria-label="Search reports" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports…" className="w-full bg-transparent text-xs outline-none placeholder:text-muted" />
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-muted">↵</kbd>
          </form>
          <ConnectionStatus />
          <button onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} theme`} className="rounded-lg border border-line p-2 text-muted transition hover:bg-paper hover:text-ink">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </header>
        <main className="min-h-[calc(100vh-4.5rem)] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
