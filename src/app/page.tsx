"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAmount, relativeDayLabel, txAmountClass, txAmountPrefix } from "@/lib/utils";
import { TxTypeIcon, txTypeBubbleClass } from "@/components/ui/tx-type-icon";
import {
  TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight,
  AlertTriangle, RefreshCw, ArrowUp, ArrowDown, Minus, Plus, Paperclip, Flame, Calendar,
  BookOpen, Search, ArrowUpRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { openAddTransaction, openCommandPalette } from "@/components/layout/nav-config";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from "recharts";

type CurrencyData = { symbol: string; balance: number; ar: number; ap: number; net: number };
type MonthlyCurrencyData = { symbol: string; total: number };

interface DashboardData {
  netWorth: Record<string, CurrencyData>;
  recentTransactions: {
    id: string; type: string; amount: number; date: string; description: string;
    currency: { symbol: string; code: string };
    account: { name: string };
    category: { name: string } | null;
    attachmentUrl?: string | null;
  }[];
  arSummary: {
    open: number; partial: number; settled: number; overdue: number;
    totalByCurrency: Record<string, { symbol: string; remaining: number }>;
  };
  apSummary: {
    open: number; partial: number; settled: number; overdue: number;
    totalByCurrency: Record<string, { symbol: string; remaining: number }>;
  };
  monthlyTotals: {
    income:      Record<string, MonthlyCurrencyData>;
    expense:     Record<string, MonthlyCurrencyData>;
    withdrawal?: Record<string, MonthlyCurrencyData>;
  };
  prevMonthTotals?: {
    income:  Record<string, number>;
    expense: Record<string, number>;
  };
  // New insight fields
  spendingByCategory?: Record<string, { category: string; amount: number; percentage: number }[]>;
  incomeByCategory?:   Record<string, { category: string; amount: number; percentage: number }[]>;
  dailyTrend?:         Record<string, { day: number; income: number; expense: number }[]>;
  historicalMonths?:   Record<string, { month: number; year: number; income: number; expense: number }[]>;
  topExpenses?:        Array<{
    amount: number; description: string | null; category: string | null; date: string;
    currency: { code: string; symbol: string };
  }>;
  avgDailySpend?: Record<string, { symbol: string; total: number }>;
}

const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Shared chart styling — recessive axes/grid, one tooltip look everywhere
const AXIS_TICK = { fontSize: 11, fill: "#94A3B8" };
const GRID_STROKE = "#E2E8F0";
const TOOLTIP_STYLE = {
  fontSize: 12, borderRadius: 14, border: "1px solid rgba(226,232,240,0.9)",
  background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
  boxShadow: "0 12px 32px -8px rgba(15,23,42,0.18)", padding: "8px 12px",
};
const CURSOR_FILL = { fill: "rgba(99,102,241,0.06)" };
const INCOME_COLOR = "#10B981";
const EXPENSE_COLOR = "#F43F5E";
const compact = (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v);

/** Animate a number from 0 → value with an ease-out curve (respects reduced motion). */
function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDisplay(value); return; }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function CountUp({ value, symbol }: { value: number; symbol: string }) {
  const v = useCountUp(value);
  return <>{formatAmount(Math.round(v * 100) / 100, symbol)}</>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState<string>("LAK");
  const router = useRouter();
  const user = useUser();

  function fetchData(m: number, y: number) {
    setLoading(true);
    setError(false);
    fetch(`/api/dashboard?month=${m}&year=${y}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        // Pick the currency with the highest absolute net worth as default
        const codes = Object.keys(d.netWorth ?? {});
        if (codes.length && !codes.includes(activeCurrency)) {
          const best = codes.reduce((a, b) =>
            Math.abs(d.netWorth[b].net) > Math.abs(d.netWorth[a].net) ? b : a, codes[0]);
          setActiveCurrency(best);
        }
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => { fetchData(month, year); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [month, year]);

  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (isCurrentMonth) return; if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  // ─── Loading / error states ───────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-slate-500 text-sm">Failed to load dashboard data.</p>
      <Button variant="outline" onClick={() => fetchData(month, year)}>
        <RefreshCw className="h-4 w-4 mr-2" />Try again
      </Button>
    </div>
  );

  // ─── Derived data ─────────────────────────────────────────────────────
  const currencyCodes = Object.keys(data.netWorth);
  const active = data.netWorth[activeCurrency] ?? data.netWorth[currencyCodes[0]];

  const chartData = ["LAK", "THB", "USD"]
    .filter(code => data.monthlyTotals.income[code] || data.monthlyTotals.expense[code])
    .map(code => ({
      currency: code,
      Income: data.monthlyTotals.income[code]?.total ?? 0,
      Expenses: data.monthlyTotals.expense[code]?.total ?? 0,
    }));

  const totalOverdue = (data.arSummary.overdue ?? 0) + (data.apSummary.overdue ?? 0);

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-2">
      {/* ─── Greeting header ──────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mt-1">
            {greeting()}{user ? <>, <span className="text-brand">{user.name.split(" ")[0]}</span></> : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 md:pb-0">
          <QuickAction icon={<Plus className="h-4 w-4" />} label="Add transaction" primary
            onClick={() => openAddTransaction("/", router.push)} />
          <QuickAction icon={<BookOpen className="h-4 w-4" />} label="Ledger" onClick={() => router.push("/ledger")} />
          <QuickAction icon={<Search className="h-4 w-4" />} label="Search" onClick={openCommandPalette} className="hidden sm:inline-flex" />
          <button
            onClick={() => fetchData(month, year)}
            className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white/70 ring-1 ring-slate-200/70 hover:bg-white transition-all tap-feedback group"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" />
          </button>
        </div>
      </header>

      {/* ─── Overdue alert ───────────────────────────────────────────── */}
      {totalOverdue > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50/60 ring-1 ring-amber-200/80 rounded-2xl px-4 py-3 animate-scale-in">
          <span className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </span>
          <p className="text-sm text-amber-800 font-medium flex-1">
            {data.arSummary.overdue > 0 && `${data.arSummary.overdue} overdue receivable${data.arSummary.overdue > 1 ? "s" : ""}`}
            {data.arSummary.overdue > 0 && data.apSummary.overdue > 0 && " · "}
            {data.apSummary.overdue > 0 && `${data.apSummary.overdue} overdue payable${data.apSummary.overdue > 1 ? "s" : ""}`}
          </p>
          <div className="flex gap-2">
            {data.arSummary.overdue > 0 && <Link href="/receivables"><Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">View AR</Button></Link>}
            {data.apSummary.overdue > 0 && <Link href="/payables"><Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">View AP</Button></Link>}
          </div>
        </div>
      )}

      {/* ─── Net Worth Hero ──────────────────────────────────────────── */}
      {currencyCodes.length > 0 && active && (
        <NetWorthHero
          data={data}
          codes={currencyCodes}
          active={activeCurrency}
          onSwitch={setActiveCurrency}
          netWorth={active}
        />
      )}

      {/* ─── Monthly Summary KPIs + Chart ────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Monthly Summary</SectionTitle>
          <MonthPicker
            month={month}
            year={year}
            onPrev={prevMonth}
            onNext={nextMonth}
            canGoForward={!isCurrentMonth}
            onToday={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }}
          />
        </div>

        {/* KPI Tiles */}
        <MonthlyKpis
          data={data}
          activeCurrency={activeCurrency}
          available={currencyCodes}
          dailyTrend={data.dailyTrend?.[activeCurrency]}
        />

        {/* Chart */}
        {chartData.length > 0 ? (
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-800 mb-3">Income vs expenses by currency</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="35%" barGap={2}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="currency" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={50} tickFormatter={compact} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR_FILL}
                  formatter={(value) => (value as number).toLocaleString()} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
                <Bar dataKey="Expenses" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card className="p-10 text-center text-slate-400 text-sm">
            No income or expense transactions in {MONTH_NAMES_LONG[month]} {year}
          </Card>
        )}
      </section>

      {/* ─── Insights: Spending by Category + Daily Trend ────────────── */}
      <SpendingInsights
        spendingByCategory={data.spendingByCategory?.[activeCurrency]}
        incomeByCategory={data.incomeByCategory?.[activeCurrency]}
        dailyTrend={data.dailyTrend?.[activeCurrency]}
        avgDailySpend={data.avgDailySpend?.[activeCurrency]}
        topExpenses={data.topExpenses ?? []}
        activeCurrency={activeCurrency}
        monthName={MONTH_NAMES_LONG[month]}
        year={year}
      />

      {/* ─── 6-Month Trend ──────────────────────────────────────────── */}
      {data.historicalMonths?.[activeCurrency] && data.historicalMonths[activeCurrency].some(m => m.income > 0 || m.expense > 0) && (
        <SixMonthTrend
          history={data.historicalMonths[activeCurrency]}
          symbol={
            data.netWorth[activeCurrency]?.symbol
            ?? data.monthlyTotals.income[activeCurrency]?.symbol
            ?? data.monthlyTotals.expense[activeCurrency]?.symbol
            ?? ""
          }
        />
      )}

      {/* ─── AR / AP Summary ─────────────────────────────────────────── */}
      <section>
        <SectionTitle>Outstanding Balances</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ArApCard
            label="Receivables"
            sublabel="Owed to you"
            href="/receivables"
            accent="emerald"
            summary={data.arSummary}
          />
          <ArApCard
            label="Payables"
            sublabel="You owe"
            href="/payables"
            accent="rose"
            summary={data.apSummary}
          />
        </div>
      </section>

      {/* ─── Recent Transactions ─────────────────────────────────────── */}
      <section>
        <SectionTitle
          right={<Link href="/transactions" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1 group">View all <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>}
        >
          Recent Activity
        </SectionTitle>

        {data.recentTransactions.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-slate-500 text-sm">No transactions yet.</p>
            <Link href="/transactions" className="inline-flex items-center gap-1 text-blue-600 text-sm mt-2 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add your first transaction
            </Link>
          </Card>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {data.recentTransactions.map(tx => <ActivityCard key={tx.id} tx={tx} />)}
            </div>
            {/* Desktop: table */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wider">
                      <th className="p-4 w-10"></th>
                      <th className="text-left p-4 font-medium text-slate-500">Date</th>
                      <th className="text-left p-4 font-medium text-slate-500">Description</th>
                      <th className="text-left p-4 font-medium text-slate-500">Account</th>
                      <th className="text-left p-4 font-medium text-slate-500">Category</th>
                      <th className="text-right p-4 font-medium text-slate-500">Amount</th>
                    </tr></thead>
                    <tbody>
                      {data.recentTransactions.map(tx => (
                        <tr key={tx.id} onClick={() => router.push("/transactions")} className="border-b border-slate-100/70 last:border-0 hover:bg-indigo-50/40 transition-colors cursor-pointer">
                          <td className="pl-4 py-3">
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${txTypeBubbleClass(tx.type)}`}>
                              <TxTypeIcon type={tx.type} className="h-4 w-4" />
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 whitespace-nowrap">{relativeDayLabel(tx.date)}</td>
                          <td className="p-4 text-slate-700">{tx.description || "—"}</td>
                          <td className="p-4 text-slate-500">{tx.account.name}</td>
                          <td className="p-4">{tx.category && <Badge variant="secondary">{tx.category.name}</Badge>}</td>
                          <td className={`p-4 text-right font-semibold whitespace-nowrap tabular ${txAmountClass(tx.type)}`}>
                            {txAmountPrefix(tx.type)}{formatAmount(tx.amount, tx.currency.symbol)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}

// ─── Net Worth Hero ────────────────────────────────────────────────────────
function NetWorthHero({
  data, codes, active, onSwitch, netWorth,
}: {
  data: DashboardData;
  codes: string[];
  active: string;
  onSwitch: (c: string) => void;
  netWorth: CurrencyData;
}) {
  const total = Math.max(netWorth.balance + netWorth.ar + netWorth.ap, 1);
  const assetsPct = (Math.max(netWorth.balance, 0) / total) * 100;
  const arPct = (netWorth.ar / total) * 100;
  const apPct = (netWorth.ap / total) * 100;
  return (
    <div className="spotlight relative overflow-hidden rounded-[1.75rem] p-6 md:p-8 text-white shadow-2xl shadow-indigo-900/20 bg-[#0B1430]">
      {/* Gradient mesh */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-500/40 blur-3xl" />
        <div className="absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-violet-500/35 blur-3xl" />
        <div className="absolute top-10 right-1/3 w-56 h-56 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      </div>

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-white/60">Net worth</p>
          {codes.length > 1 && (
            <div className="flex p-1 rounded-full bg-white/10 ring-1 ring-white/10 backdrop-blur" role="tablist" aria-label="Currency">
              {codes.map(c => {
                const isActive = c === active;
                return (
                  <button
                    key={c}
                    onClick={() => onSwitch(c)}
                    role="tab"
                    aria-selected={isActive}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-all duration-300 tap-feedback
                      ${isActive ? "bg-white text-slate-900 shadow-md" : "text-white/70 hover:text-white"}`}
                  >
                    {data.netWorth[c].symbol} {c}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className={`text-4xl md:text-6xl font-semibold tracking-tight mt-3 tabular ${netWorth.net >= 0 ? "text-white" : "text-rose-300"}`}>
          <CountUp value={netWorth.net} symbol={netWorth.symbol} />
        </p>

        {/* Horizontal breakdown bar */}
        <div className="mt-6 md:mt-8">
          <div className="flex gap-0.5 h-2 w-full rounded-full overflow-hidden bg-white/10">
            {assetsPct > 0 && <div className="progress-bar h-full rounded-full bg-white/90" style={{ ["--progress-width" as string]: `${assetsPct}%` }} title={`Assets ${formatAmount(netWorth.balance, netWorth.symbol)}`} />}
            {arPct > 0     && <div className="progress-bar h-full rounded-full bg-emerald-400" style={{ ["--progress-width" as string]: `${arPct}%` }} title={`AR ${formatAmount(netWorth.ar, netWorth.symbol)}`} />}
            {apPct > 0     && <div className="progress-bar h-full rounded-full bg-rose-400" style={{ ["--progress-width" as string]: `${apPct}%` }} title={`AP ${formatAmount(netWorth.ap, netWorth.symbol)}`} />}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-4">
            <BreakdownItem color="bg-white/90"    label="Assets"      value={formatAmount(netWorth.balance, netWorth.symbol)} />
            <BreakdownItem color="bg-emerald-400" label="Owed to you" value={`+${formatAmount(netWorth.ar, netWorth.symbol)}`} />
            <BreakdownItem color="bg-rose-400"    label="You owe"     value={`−${formatAmount(netWorth.ap, netWorth.symbol)}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] ring-1 ring-white/10 px-3 py-2.5 min-w-0 flex sm:block items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <span className={`block w-1.5 h-1.5 rounded-full ${color}`} />
        <span className="text-xs sm:text-[11px] text-white/60 font-medium truncate">{label}</span>
      </div>
      <p className="font-semibold text-sm md:text-base text-white sm:mt-0.5 truncate tabular">{value}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick, primary, className }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`${className ?? "inline-flex"} h-10 shrink-0 items-center gap-2 px-4 rounded-xl text-sm font-semibold transition-all duration-200 tap-feedback
        ${primary
          ? "bg-brand text-white shadow-lg shadow-indigo-500/30 ring-1 ring-inset ring-white/20 hover:shadow-indigo-500/45 hover:-translate-y-px"
          : "bg-white/70 text-slate-700 ring-1 ring-slate-200/70 hover:bg-white hover:text-slate-900"}`}
    >
      {icon}{label}
    </button>
  );
}

// ─── Monthly KPI Tiles ─────────────────────────────────────────────────────
function MonthlyKpis({
  data, activeCurrency, available, dailyTrend,
}: {
  data: DashboardData;
  activeCurrency: string;
  available: string[];
  dailyTrend?: { day: number; income: number; expense: number }[];
}) {
  // Use the active currency if it has data; fall back to any with data
  const codes = available.filter(c => data.monthlyTotals.income[c] || data.monthlyTotals.expense[c]);
  const code = codes.includes(activeCurrency) ? activeCurrency : codes[0];

  if (!code) {
    return (
      <Card className="p-4 text-center text-slate-400 text-sm">
        No income or expenses yet this month.
      </Card>
    );
  }

  const income     = data.monthlyTotals.income[code]?.total  ?? 0;
  const expense    = data.monthlyTotals.expense[code]?.total ?? 0;
  const symbol     = data.monthlyTotals.income[code]?.symbol ?? data.monthlyTotals.expense[code]?.symbol ?? "";
  const savings    = income - expense;
  const prevIncome  = data.prevMonthTotals?.income[code]  ?? 0;
  const prevExpense = data.prevMonthTotals?.expense[code] ?? 0;

  const incomeDelta  = prevIncome  > 0 ? ((income  - prevIncome)  / prevIncome)  * 100 : null;
  const expenseDelta = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : null;
  const savingsRate  = income > 0 ? (savings / income) * 100 : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
      <KpiTile
        label="Income"
        value={formatAmount(income, symbol)}
        valueClass="text-slate-900"
        delta={incomeDelta}
        deltaGoodDirection="up"
        icon={<TrendingUp className="h-4 w-4" />}
        iconClass="bg-emerald-500/10 text-emerald-600"
        spark={code === activeCurrency ? dailyTrend?.map(d => d.income) : undefined}
        sparkColor={INCOME_COLOR}
      />
      <KpiTile
        label="Expense"
        value={formatAmount(expense, symbol)}
        valueClass="text-slate-900"
        delta={expenseDelta}
        deltaGoodDirection="down"
        icon={<TrendingDown className="h-4 w-4" />}
        iconClass="bg-rose-500/10 text-rose-500"
        spark={code === activeCurrency ? dailyTrend?.map(d => d.expense) : undefined}
        sparkColor={EXPENSE_COLOR}
      />
      <KpiTile
        label="Savings"
        value={formatAmount(savings, symbol)}
        valueClass={savings >= 0 ? "text-slate-900" : "text-rose-600"}
        delta={savingsRate}
        deltaSuffix="%"
        deltaIsRate
        icon={<Wallet className="h-4 w-4" />}
        iconClass="bg-indigo-500/10 text-indigo-600"
        className="col-span-2 md:col-span-1"
      />
    </div>
  );
}

function KpiTile({
  label, value, valueClass, delta, deltaGoodDirection, deltaSuffix, deltaIsRate, icon, iconClass, spark, sparkColor, className,
}: {
  label: string;
  value: string;
  valueClass?: string;
  delta?: number | null;
  /** "up" = positive delta is good (green up arrow); "down" = positive delta is bad (red up arrow) */
  deltaGoodDirection?: "up" | "down";
  deltaSuffix?: string;
  deltaIsRate?: boolean; // for "savings rate" — display value rather than vs-last comparison
  icon?: React.ReactNode;
  iconClass?: string;
  /** Daily values for a background sparkline */
  spark?: number[];
  sparkColor?: string;
  className?: string;
}) {
  let deltaText: string | null = null;
  let deltaColor = "text-slate-400";
  let deltaIcon: React.ReactNode = null;
  if (delta !== null && delta !== undefined && isFinite(delta)) {
    const abs = Math.abs(delta);
    deltaText = `${abs.toFixed(0)}${deltaSuffix ?? "%"}`;
    if (deltaIsRate) {
      // For savings rate: show the rate itself
      deltaColor = delta >= 0 ? "text-emerald-600" : "text-rose-500";
      deltaIcon = delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
      deltaText = `${delta >= 0 ? "" : "−"}${abs.toFixed(0)}% rate`;
    } else if (Math.abs(delta) < 0.5) {
      deltaIcon = <Minus className="h-3 w-3" />;
      deltaText = "flat";
    } else {
      const goingUp = delta > 0;
      const isGood = deltaGoodDirection === "up" ? goingUp : !goingUp;
      deltaColor = isGood ? "text-emerald-600" : "text-rose-500";
      deltaIcon  = goingUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
    }
  }
  const hasSpark = spark && spark.some(v => v > 0);
  const sparkId = `spark-${label}`;
  return (
    <Card className={`p-3 md:p-5 card-glow overflow-hidden ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="text-[11px] md:text-sm font-medium text-slate-500">{label}</span>
        <span className={`hidden sm:flex w-8 h-8 rounded-xl items-center justify-center ${iconClass ?? "bg-slate-100 text-slate-500"}`}>{icon}</span>
      </div>
      <p className={`font-semibold text-base md:text-2xl tracking-tight tabular ${valueClass ?? "text-slate-900"} truncate`}>
        {value}
      </p>
      {deltaText && (
        <p className={`text-[11px] mt-1 flex items-center gap-0.5 ${deltaColor}`}>
          {deltaIcon}
          <span className="font-semibold">{deltaText}</span>
          {!deltaIsRate && <span className="text-slate-400 ml-0.5 hidden sm:inline">vs last month</span>}
        </p>
      )}
      {hasSpark && (
        <div className="h-10 -mx-3 md:-mx-5 -mb-3 md:-mb-5 mt-2" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark!.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} fill={`url(#${sparkId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// ─── Month Picker ──────────────────────────────────────────────────────────
function MonthPicker({
  month, year, onPrev, onNext, canGoForward, onToday,
}: {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  canGoForward: boolean;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-white/80 backdrop-blur rounded-xl ring-1 ring-slate-200/70 px-1 py-1 shadow-sm shadow-slate-900/[0.03]">
      <button onClick={onPrev} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors" aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold text-slate-700 px-2 min-w-[5.5rem] text-center">
        {MONTH_NAMES_SHORT[month]} {year}
      </span>
      <button onClick={onNext} disabled={!canGoForward}
        className={`p-1 rounded-lg transition-colors ${canGoForward ? "hover:bg-slate-100 text-slate-500 hover:text-slate-900" : "text-slate-200 cursor-not-allowed"}`}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {canGoForward && (
        <button onClick={onToday}
          className="text-[11px] text-indigo-600 hover:text-indigo-700 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 font-semibold ml-0.5">
          Today
        </button>
      )}
    </div>
  );
}

// ─── AR / AP Card ──────────────────────────────────────────────────────────
function ArApCard({
  label, sublabel, href, accent, summary,
}: {
  label: string;
  sublabel: string;
  href: string;
  accent: "emerald" | "rose";
  summary: {
    open: number; partial: number; settled: number; overdue: number;
    totalByCurrency: Record<string, { symbol: string; remaining: number }>;
  };
}) {
  const accentClasses = {
    emerald: { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-100" },
    rose:    { text: "text-rose-500",    bg: "bg-rose-50",    ring: "ring-rose-100" },
  }[accent];
  const totals = Object.entries(summary.totalByCurrency);
  return (
    <Link href={href} className="block group">
    <Card className="p-5 card-glow h-full">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accentClasses.bg} ${accentClasses.text}`}>
            {accent === "emerald" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{label}</p>
            <p className="text-xs text-slate-400">{sublabel}</p>
          </div>
        </div>
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 bg-slate-900/[0.04] group-hover:bg-brand group-hover:text-white transition-all duration-300 group-hover:rotate-45">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      {totals.length === 0 ? (
        <p className="text-sm text-slate-400">All settled ✓</p>
      ) : (
        <div className="space-y-1.5">
          {totals.map(([code, t]) => (
            <div key={code} className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{code}</span>
              <span className={`text-xl md:text-2xl font-semibold tracking-tight tabular ${accentClasses.text}`}>
                {formatAmount(t.remaining, t.symbol)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 flex-wrap mt-4 pt-3 border-t border-slate-100">
        {summary.open > 0     && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{summary.open} open</span>}
        {summary.partial > 0  && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{summary.partial} partial</span>}
        {summary.settled > 0  && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{summary.settled} settled</span>}
        {summary.overdue > 0  && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 pulse-dot" />{summary.overdue} overdue</span>}
      </div>
    </Card>
    </Link>
  );
}

// ─── Activity Card (mobile) ────────────────────────────────────────────────
function ActivityCard({ tx }: { tx: DashboardData["recentTransactions"][number] }) {
  return (
    <Link
      href="/transactions"
      className="bg-white/85 backdrop-blur rounded-2xl ring-1 ring-slate-200/60 shadow-sm shadow-slate-900/[0.03] p-3.5 flex items-center gap-3 card-hover tap-feedback"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${txTypeBubbleClass(tx.type)}`}>
        <TxTypeIcon type={tx.type} className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate flex items-center gap-1.5">
          {tx.description || "(no description)"}
          {tx.attachmentUrl && <Paperclip className="h-3 w-3 text-blue-400 shrink-0" />}
        </p>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {relativeDayLabel(tx.date)} · {tx.account.name}{tx.category && ` · ${tx.category.name}`}
        </p>
      </div>
      <p className={`font-semibold text-sm whitespace-nowrap shrink-0 tabular ${txAmountClass(tx.type)}`}>
        {txAmountPrefix(tx.type)}{formatAmount(tx.amount, tx.currency.symbol)}
      </p>
    </Link>
  );
}

// ─── Section Title ─────────────────────────────────────────────────────────
function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        {children}
      </h2>
      {right}
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="shimmer w-64 h-10 rounded-xl" />
      <div className="shimmer h-56 rounded-[1.75rem]" />
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-2xl" />)}
      </div>
      <div className="shimmer h-56 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="shimmer h-32 rounded-2xl" />
        <div className="shimmer h-32 rounded-2xl" />
      </div>
      <div className="shimmer h-64 rounded-2xl" />
    </div>
  );
}

// ─── Spending Insights ────────────────────────────────────────────────────
// Validated categorical palette (CVD-safe in fixed order). More than 8 categories fold into "Other".
const CATEGORY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const OTHER_COLOR = "#94A3B8";

function foldCategories(list: { category: string; amount: number; percentage: number }[]) {
  if (list.length <= CATEGORY_COLORS.length) return list.map((c, i) => ({ ...c, color: CATEGORY_COLORS[i] }));
  const head = list.slice(0, CATEGORY_COLORS.length - 1).map((c, i) => ({ ...c, color: CATEGORY_COLORS[i] }));
  const rest = list.slice(CATEGORY_COLORS.length - 1);
  return [...head, {
    category: `Other (${rest.length})`,
    amount: rest.reduce((a, c) => a + c.amount, 0),
    percentage: rest.reduce((a, c) => a + c.percentage, 0),
    color: OTHER_COLOR,
  }];
}

function SpendingInsights({
  spendingByCategory, incomeByCategory, dailyTrend, avgDailySpend, topExpenses,
  activeCurrency, monthName, year,
}: {
  spendingByCategory?: { category: string; amount: number; percentage: number }[];
  incomeByCategory?:   { category: string; amount: number; percentage: number }[];
  dailyTrend?:         { day: number; income: number; expense: number }[];
  avgDailySpend?:      { symbol: string; total: number };
  topExpenses:         Array<{ amount: number; description: string | null; category: string | null; date: string; currency: { code: string; symbol: string } }>;
  activeCurrency: string;
  monthName: string;
  year: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const hasSpending = (spendingByCategory?.length ?? 0) > 0;
  const hasIncome   = (incomeByCategory?.length ?? 0) > 0;
  const hasDailyTrend = (dailyTrend?.length ?? 0) > 0 && (dailyTrend ?? []).some(d => d.income > 0 || d.expense > 0);
  if (!hasSpending && !hasIncome && !hasDailyTrend) return null;

  const symbol = avgDailySpend?.symbol ?? "";
  const slices = foldCategories(spendingByCategory ?? []);
  const totalSpend = slices.reduce((a, c) => a + c.amount, 0);
  const focus = hovered !== null ? slices[hovered] : null;
  const filteredTopExpenses = topExpenses.filter(t => t.currency.code === activeCurrency);

  return (
    <section>
      <SectionTitle right={<span className="text-[11px] text-slate-400 font-medium">{monthName} {year} · {activeCurrency}</span>}>
        Spending Insights
      </SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Category donut + ranked list */}
        {hasSpending && (
          <Card className="p-5 lg:col-span-2">
            <p className="text-sm font-semibold text-slate-800">Where your money went</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 items-center">
              <div className="relative h-[220px]" onMouseLeave={() => setHovered(null)}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices}
                      cx="50%" cy="50%"
                      innerRadius={66} outerRadius={92}
                      paddingAngle={1}
                      cornerRadius={4}
                      dataKey="amount"
                      stroke="#fff"
                      strokeWidth={2}
                      onMouseEnter={(_, i) => setHovered(i)}
                    >
                      {slices.map((c, i) => (
                        <Cell
                          key={c.category}
                          fill={c.color}
                          style={{ transition: "opacity 0.2s", cursor: "pointer", outline: "none" }}
                          opacity={hovered === null || hovered === i ? 1 : 0.3}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Centre readout — follows the hovered slice */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-10">
                  <p className="text-[11px] font-medium text-slate-400 truncate max-w-full">{focus ? focus.category : "Total spent"}</p>
                  <p className="text-lg font-semibold text-slate-900 tabular">
                    {symbol}{Math.round(focus ? focus.amount : totalSpend).toLocaleString()}
                  </p>
                  {focus && <p className="text-[11px] text-slate-500 tabular">{focus.percentage.toFixed(1)}%</p>}
                </div>
              </div>

              {/* Categories ranked — doubles as the legend; hover syncs with the donut */}
              <div className="space-y-0.5">
                {slices.map((c, i) => (
                  <div
                    key={c.category}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 transition-colors cursor-default ${hovered === i ? "bg-slate-900/[0.04]" : ""}`}
                  >
                    <span className="block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="text-slate-700 font-medium flex-1 truncate">{c.category}</span>
                    <span className="text-slate-500 tabular">{c.percentage.toFixed(0)}%</span>
                    <span className="text-slate-900 font-semibold tabular whitespace-nowrap">{symbol}{Math.round(c.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Avg daily + top expenses callout */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-800">Highlights</p>
          {avgDailySpend && avgDailySpend.total > 0 && (
            <div className="mt-3 pb-3 border-b border-slate-100">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Average daily spend
              </p>
              <p className="text-2xl font-semibold text-slate-900 tracking-tight mt-0.5 tabular">
                {avgDailySpend.symbol}{Math.round(avgDailySpend.total).toLocaleString()}
              </p>
            </div>
          )}
          {filteredTopExpenses.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1 mb-2">
                <Flame className="h-3 w-3" /> Biggest expenses
              </p>
              <ul className="space-y-2">
                {filteredTopExpenses.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 text-rose-600 font-bold text-[10px] shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{t.description || "(no description)"}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t.category ?? "Uncategorized"}</p>
                    </div>
                    <p className="font-bold text-rose-500 text-xs tabular-nums whitespace-nowrap">{t.currency.symbol}{Math.round(t.amount).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!filteredTopExpenses.length && !(avgDailySpend && avgDailySpend.total > 0) && (
            <p className="text-sm text-slate-400 mt-3">No spending yet for {activeCurrency}.</p>
          )}
        </Card>
      </div>

      {/* Daily trend area chart */}
      {hasDailyTrend && (
        <Card className="p-5 mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-800">Daily flow this month</p>
            <span className="text-[10px] text-slate-400">{activeCurrency}</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EXPENSE_COLOR} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={EXPENSE_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                ticks={dailyTrend ? Array.from(new Set(dailyTrend.filter((_, i) => i % 5 === 0).map(d => d.day))) : []} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={42}
                tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: "#6366F1", strokeWidth: 1, strokeDasharray: "4 4" }}
                formatter={((value: unknown) => Number(value ?? 0).toLocaleString()) as never}
                labelFormatter={(label) => `Day ${label}`}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="income"  name="Income"  stroke={INCOME_COLOR}  strokeWidth={2} fill="url(#gradIncome)"
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
              <Area type="monotone" dataKey="expense" name="Expense" stroke={EXPENSE_COLOR} strokeWidth={2} fill="url(#gradExpense)"
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </section>
  );
}

// ─── 6-Month Trend ────────────────────────────────────────────────────────
const MONTH_LETTERS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function SixMonthTrend({
  history, symbol,
}: {
  history: { month: number; year: number; income: number; expense: number }[];
  symbol: string;
}) {
  const data = history.map(h => ({
    label: `${MONTH_LETTERS[h.month]} ${String(h.year).slice(2)}`,
    Income: h.income,
    Expenses: h.expense,
    Savings: h.income - h.expense,
  }));
  return (
    <section>
      <SectionTitle>Six-Month Trend</SectionTitle>
      <Card className="p-5">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barCategoryGap="20%" barGap={2}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={50}
              tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={CURSOR_FILL}
              formatter={((value: unknown) => `${symbol}${Number(value ?? 0).toLocaleString()}`) as never}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Income"   fill={INCOME_COLOR}  radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Bar dataKey="Expenses" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}
