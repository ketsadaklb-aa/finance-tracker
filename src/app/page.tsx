"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAmount, relativeDayLabel, txAmountClass, txAmountPrefix } from "@/lib/utils";
import { TxTypeIcon, txTypeBubbleClass } from "@/components/ui/tx-type-icon";
import {
  TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight,
  AlertTriangle, RefreshCw, ArrowUp, ArrowDown, Minus, Plus, Paperclip,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
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
}

const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{greeting()}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-0.5">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => fetchData(month, year)}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors tap-feedback"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {/* ─── Overdue alert ───────────────────────────────────────────── */}
      {totalOverdue > 0 && (
        <div className="flex flex-wrap items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 animate-scale-in">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
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
        />

        {/* Chart */}
        {chartData.length > 0 ? (
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Income vs Expenses</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="35%">
                <XAxis dataKey="currency" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={50}
                  tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}
                  formatter={(value) => (value as number).toLocaleString()}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Income" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expenses" fill="#F43F5E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card className="p-10 text-center text-slate-400 text-sm">
            No income or expense transactions in {MONTH_NAMES_LONG[month]} {year}
          </Card>
        )}
      </section>

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
          right={<Link href="/transactions" className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline">View all →</Link>}
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
                    <thead><tr className="border-b border-slate-100">
                      <th className="p-4 w-10"></th>
                      <th className="text-left p-4 font-medium text-slate-500">Date</th>
                      <th className="text-left p-4 font-medium text-slate-500">Description</th>
                      <th className="text-left p-4 font-medium text-slate-500">Account</th>
                      <th className="text-left p-4 font-medium text-slate-500">Category</th>
                      <th className="text-right p-4 font-medium text-slate-500">Amount</th>
                    </tr></thead>
                    <tbody>
                      {data.recentTransactions.map(tx => (
                        <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="pl-4 py-3">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${txTypeBubbleClass(tx.type)}`}>
                              <TxTypeIcon type={tx.type} className="h-4 w-4" />
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 whitespace-nowrap">{relativeDayLabel(tx.date)}</td>
                          <td className="p-4 text-slate-700">{tx.description || "—"}</td>
                          <td className="p-4 text-slate-500">{tx.account.name}</td>
                          <td className="p-4">{tx.category && <Badge variant="secondary">{tx.category.name}</Badge>}</td>
                          <td className={`p-4 text-right font-semibold whitespace-nowrap ${txAmountClass(tx.type)}`}>
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
  const total = Math.max(netWorth.balance + netWorth.ar, netWorth.ap, 1);
  const assetsPct = (netWorth.balance / total) * 100;
  const arPct = (netWorth.ar / total) * 100;
  const apPct = (netWorth.ap / total) * 100;
  return (
    <Card className="overflow-hidden relative">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500" />
      <div className="p-5 md:p-6">
        {/* Currency tabs */}
        {codes.length > 1 && (
          <div className="flex gap-1.5 mb-4 -mx-1 overflow-x-auto pb-0.5">
            {codes.map(c => {
              const isActive = c === active;
              return (
                <button
                  key={c}
                  onClick={() => onSwitch(c)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap transition-all tap-feedback
                    ${isActive ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  aria-pressed={isActive}
                >
                  {c} {data.netWorth[c].symbol}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net worth · {active}</p>
        <p className={`text-3xl md:text-5xl font-extrabold tracking-tight mt-1 ${netWorth.net >= 0 ? "text-slate-900" : "text-rose-600"}`}>
          {formatAmount(netWorth.net, netWorth.symbol)}
        </p>

        {/* Horizontal breakdown bar */}
        <div className="mt-5">
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-100">
            {assetsPct > 0 && <div className="h-full bg-slate-700" style={{ width: `${assetsPct}%` }} title={`Assets ${formatAmount(netWorth.balance, netWorth.symbol)}`} />}
            {arPct > 0     && <div className="h-full bg-emerald-500" style={{ width: `${arPct}%` }} title={`AR ${formatAmount(netWorth.ar, netWorth.symbol)}`} />}
            {apPct > 0     && <div className="h-full bg-rose-400" style={{ width: `${apPct}%` }} title={`AP ${formatAmount(netWorth.ap, netWorth.symbol)}`} />}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
            <BreakdownItem color="bg-slate-700"    label="Assets" value={formatAmount(netWorth.balance, netWorth.symbol)} />
            <BreakdownItem color="bg-emerald-500"  label="AR"     value={`+${formatAmount(netWorth.ar, netWorth.symbol)}`} />
            <BreakdownItem color="bg-rose-400"     label="AP"     value={`-${formatAmount(netWorth.ap, netWorth.symbol)}`} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function BreakdownItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`block w-1.5 h-1.5 rounded-full ${color}`} />
        <span className="text-slate-500 font-medium">{label}</span>
      </div>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  );
}

// ─── Monthly KPI Tiles ─────────────────────────────────────────────────────
function MonthlyKpis({
  data, activeCurrency, available,
}: {
  data: DashboardData;
  activeCurrency: string;
  available: string[];
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
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      <KpiTile
        label="Income"
        value={formatAmount(income, symbol)}
        valueClass="text-emerald-600"
        delta={incomeDelta}
        deltaGoodDirection="up"
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <KpiTile
        label="Expense"
        value={formatAmount(expense, symbol)}
        valueClass="text-rose-500"
        delta={expenseDelta}
        deltaGoodDirection="down"
        icon={<TrendingDown className="h-4 w-4" />}
      />
      <KpiTile
        label="Savings"
        value={formatAmount(savings, symbol)}
        valueClass={savings >= 0 ? "text-slate-900" : "text-rose-600"}
        delta={savingsRate}
        deltaSuffix="%"
        deltaIsRate
        icon={<Wallet className="h-4 w-4" />}
      />
    </div>
  );
}

function KpiTile({
  label, value, valueClass, delta, deltaGoodDirection, deltaSuffix, deltaIsRate, icon,
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
  return (
    <Card className="p-3 md:p-4 card-glow">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-slate-300">{icon}</span>
      </div>
      <p className={`font-bold text-base md:text-xl tracking-tight ${valueClass ?? "text-slate-900"} truncate`}>
        {value}
      </p>
      {deltaText && (
        <p className={`text-[11px] mt-0.5 flex items-center gap-0.5 ${deltaColor}`}>
          {deltaIcon}
          <span className="font-medium">{deltaText}</span>
          {!deltaIsRate && <span className="text-slate-400 ml-0.5 hidden sm:inline">vs last month</span>}
        </p>
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
    <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 px-1 py-0.5 shadow-sm">
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
          className="text-[11px] text-blue-600 hover:text-blue-700 px-1.5 py-0.5 rounded-md hover:bg-blue-50 font-semibold ml-0.5">
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
    <Card className="p-5 card-glow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>
        </div>
        <Link href={href} className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline shrink-0">View all →</Link>
      </div>
      {totals.length === 0 ? (
        <p className="text-sm text-slate-400">All settled ✓</p>
      ) : (
        <div className="space-y-1.5">
          {totals.map(([code, t]) => (
            <div key={code} className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{code}</span>
              <span className={`text-xl md:text-2xl font-bold tracking-tight ${accentClasses.text}`}>
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
        {summary.overdue > 0  && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium animate-pulse">{summary.overdue} overdue!</span>}
      </div>
    </Card>
  );
}

// ─── Activity Card (mobile) ────────────────────────────────────────────────
function ActivityCard({ tx }: { tx: DashboardData["recentTransactions"][number] }) {
  return (
    <Link
      href="/transactions"
      className="block bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 flex items-center gap-3 card-hover tap-feedback"
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
      <p className={`font-bold text-sm whitespace-nowrap shrink-0 ${txAmountClass(tx.type)}`}>
        {txAmountPrefix(tx.type)}{formatAmount(tx.amount, tx.currency.symbol)}
      </p>
    </Link>
  );
}

// ─── Section Title ─────────────────────────────────────────────────────────
function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <span className="block w-1 h-3 rounded-full bg-blue-500" aria-hidden="true" />
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
      <div className="shimmer w-40 h-7 rounded" />
      <div className="shimmer h-44 rounded-2xl" />
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
