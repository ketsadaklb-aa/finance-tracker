"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAmount, formatDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, ArrowUpDown, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
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
    income: Record<string, MonthlyCurrencyData>;
    expense: Record<string, MonthlyCurrencyData>;
  };
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function fetchData(m: number, y: number) {
    setLoading(true);
    setError(false);
    fetch(`/api/dashboard?month=${m}&year=${y}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => { fetchData(month, year); }, [month, year]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
    if (isCurrentMonth) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  const allCurrencies = ["LAK", "THB", "USD"];

  if (loading) return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><div className="shimmer w-32 h-7 rounded mb-2" /><div className="shimmer w-48 h-4 rounded" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="shimmer h-32 rounded-xl" />)}</div>
      <div className="shimmer h-64 rounded-xl" />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-slate-500 text-sm">Failed to load dashboard data.</p>
      <Button variant="outline" onClick={() => fetchData(month, year)}>
        <RefreshCw className="h-4 w-4 mr-2" />Try again
      </Button>
    </div>
  );

  const chartData = allCurrencies
    .filter(code => data.monthlyTotals.income[code] || data.monthlyTotals.expense[code])
    .map(code => ({
      currency: code,
      Income: data.monthlyTotals.income[code]?.total ?? 0,
      Expenses: data.monthlyTotals.expense[code]?.total ?? 0,
    }));

  // Savings per currency
  const savingsByCurrency = allCurrencies.reduce((acc, code) => {
    const inc = data.monthlyTotals.income[code]?.total ?? 0;
    const exp = data.monthlyTotals.expense[code]?.total ?? 0;
    if (inc > 0 || exp > 0) acc[code] = { symbol: data.monthlyTotals.income[code]?.symbol ?? data.monthlyTotals.expense[code]?.symbol, savings: inc - exp };
    return acc;
  }, {} as Record<string, { symbol: string; savings: number }>);

  const totalOverdue = (data.arSummary.overdue ?? 0) + (data.apSummary.overdue ?? 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Your financial overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(month, year)}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {/* Overdue alert banner */}
      {totalOverdue > 0 && (
        <div className="flex flex-wrap items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 animate-scale-in">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-700 font-medium flex-1">
            {data.arSummary.overdue > 0 && `${data.arSummary.overdue} overdue receivable${data.arSummary.overdue > 1 ? "s" : ""}`}
            {data.arSummary.overdue > 0 && data.apSummary.overdue > 0 && " · "}
            {data.apSummary.overdue > 0 && `${data.apSummary.overdue} overdue payable${data.apSummary.overdue > 1 ? "s" : ""}`}
          </p>
          <div className="flex gap-2">
            {data.arSummary.overdue > 0 && <Link href="/receivables"><Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-100 h-7 text-xs">View AR</Button></Link>}
            {data.apSummary.overdue > 0 && <Link href="/payables"><Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-100 h-7 text-xs">View AP</Button></Link>}
          </div>
        </div>
      )}

      {/* Net Worth */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Net Worth by Currency</h2>
        {Object.keys(data.netWorth).length === 0 ? (
          <p className="text-slate-400 text-sm">No accounts yet. <Link href="/accounts" className="text-blue-500 underline">Add an account</Link> to get started.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
            {allCurrencies.map((code) => {
              const d = data.netWorth[code];
              if (!d) return null;
              return (
                <Card key={code} className="animate-fade-in card-hover">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-500 flex items-center justify-between">
                      <span>{code}</span><span className="text-slate-300">{d.symbol}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Assets</span><span className="font-medium">{formatAmount(d.balance, d.symbol)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-green-600">AR (owed to you)</span><span className="font-medium text-green-600">+{formatAmount(d.ar, d.symbol)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-red-500">AP (you owe)</span><span className="font-medium text-red-500">-{formatAmount(d.ap, d.symbol)}</span></div>
                    <div className="border-t border-slate-100 pt-2 flex justify-between">
                      <span className="font-semibold text-slate-700">Net</span>
                      <span className={`font-bold text-lg ${d.net >= 0 ? "text-slate-900" : "text-red-600"}`}>{formatAmount(d.net, d.symbol)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Monthly Chart + Totals with month picker */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Summary</h2>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 w-32 text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} disabled={isCurrentMonth}
              className={`p-1 rounded transition-colors ${isCurrentMonth ? "text-slate-200 cursor-not-allowed" : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"}`}>
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isCurrentMonth && (
              <button onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }}
                className="text-xs text-blue-500 hover:text-blue-700 ml-1 underline">Today</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {chartData.length > 0 ? (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-700">Income vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barCategoryGap="30%">
                    <XAxis dataKey="currency" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={60}
                      tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      formatter={(value) => (value as number).toLocaleString()} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Income" fill="#22C55E" radius={[4,4,0,0]} />
                    <Bar dataKey="Expenses" fill="#EF4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card className="lg:col-span-2 flex items-center justify-center">
              <CardContent className="py-12 text-slate-400 text-sm">No transactions in {MONTH_NAMES[month]} {year}</CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2"><TrendingUp className="h-4 w-4" />Income</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(data.monthlyTotals.income).length === 0
                  ? <p className="text-slate-400 text-sm">No income</p>
                  : Object.entries(data.monthlyTotals.income).map(([code, d]) => (
                    <div key={code} className="flex justify-between text-sm"><span className="text-slate-500">{code}</span><span className="font-medium text-green-600">{formatAmount(d.total, d.symbol)}</span></div>
                  ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2"><TrendingDown className="h-4 w-4" />Expenses</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(data.monthlyTotals.expense).length === 0
                  ? <p className="text-slate-400 text-sm">No expenses</p>
                  : Object.entries(data.monthlyTotals.expense).map(([code, d]) => (
                    <div key={code} className="flex justify-between text-sm"><span className="text-slate-500">{code}</span><span className="font-medium text-red-500">{formatAmount(d.total, d.symbol)}</span></div>
                  ))}
              </CardContent>
            </Card>
            {Object.keys(savingsByCurrency).length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">Savings</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {Object.entries(savingsByCurrency).map(([code, d]) => (
                    <div key={code} className="flex justify-between text-sm">
                      <span className="text-slate-500">{code}</span>
                      <span className={`font-semibold ${d.savings >= 0 ? "text-slate-800" : "text-red-500"}`}>
                        {d.savings >= 0 ? "+" : ""}{formatAmount(d.savings, d.symbol)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* AR / AP Summary */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">AR / AP Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-green-600" />Receivables (AR)</span>
                <Link href="/receivables" className="text-xs text-blue-500 hover:underline font-normal">View all →</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="destructive">{data.arSummary.open} Open</Badge>
                <Badge variant="warning">{data.arSummary.partial} Partial</Badge>
                <Badge variant="success">{data.arSummary.settled} Settled</Badge>
                {data.arSummary.overdue > 0 && <Badge variant="destructive">{data.arSummary.overdue} Overdue</Badge>}
              </div>
              {Object.entries(data.arSummary.totalByCurrency).map(([code, d]) => (
                <div key={code} className="flex justify-between text-sm"><span className="text-slate-500">{code} remaining</span><span className="font-medium text-green-600">{formatAmount(d.remaining, d.symbol)}</span></div>
              ))}
              {Object.keys(data.arSummary.totalByCurrency).length === 0 && <p className="text-slate-400 text-sm">All settled</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-red-500" />Payables (AP)</span>
                <Link href="/payables" className="text-xs text-blue-500 hover:underline font-normal">View all →</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="destructive">{data.apSummary.open} Open</Badge>
                <Badge variant="warning">{data.apSummary.partial} Partial</Badge>
                <Badge variant="success">{data.apSummary.settled} Settled</Badge>
                {data.apSummary.overdue > 0 && <Badge variant="destructive">{data.apSummary.overdue} Overdue</Badge>}
              </div>
              {Object.entries(data.apSummary.totalByCurrency).map(([code, d]) => (
                <div key={code} className="flex justify-between text-sm"><span className="text-slate-500">{code} remaining</span><span className="font-medium text-red-500">{formatAmount(d.remaining, d.symbol)}</span></div>
              ))}
              {Object.keys(data.apSummary.totalByCurrency).length === 0 && <p className="text-slate-400 text-sm">All paid</p>}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Recent Transactions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2"><ArrowUpDown className="h-4 w-4" />Recent Transactions</h2>
          <Link href="/transactions" className="text-xs text-blue-500 hover:underline">View all →</Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {data.recentTransactions.length === 0 ? (
              <p className="p-6 text-slate-400 text-sm">No transactions yet. <Link href="/transactions" className="text-blue-500 underline">Add one</Link></p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left p-4 font-medium text-slate-500">Date</th>
                    <th className="text-left p-4 font-medium text-slate-500">Description</th>
                    <th className="text-left p-4 font-medium text-slate-500">Account</th>
                    <th className="text-left p-4 font-medium text-slate-500">Category</th>
                    <th className="text-right p-4 font-medium text-slate-500">Amount</th>
                  </tr></thead>
                  <tbody>
                    {data.recentTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                        <td className="p-4 text-slate-700">{tx.description || "—"}</td>
                        <td className="p-4 text-slate-500">{tx.account.name}</td>
                        <td className="p-4">{tx.category && <Badge variant="secondary">{tx.category.name}</Badge>}</td>
                        <td className={`p-4 text-right font-medium whitespace-nowrap ${
                          tx.type === "income" ? "text-green-600" : tx.type === "expense" ? "text-red-500" : "text-slate-500"
                        }`}>
                          {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
                          {formatAmount(tx.amount, tx.currency.symbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
