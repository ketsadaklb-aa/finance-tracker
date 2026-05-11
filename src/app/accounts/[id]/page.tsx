"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatAmount, relativeDayLabel,
  TX_TYPES, type TxType, txAmountClass, txAmountPrefix, txTypeMeta,
} from "@/lib/utils";
import {
  ArrowLeft, Wallet, Paperclip, Search, X,
  TrendingUp, TrendingDown, ArrowLeftRight, Landmark,
} from "lucide-react";

interface Currency { id: string; code: string; symbol: string; name: string }
interface Account { id: string; name: string; type: string; balance: number; currency: Currency; note: string | null }
interface Category { id: string; name: string }
interface Transaction {
  id: string; type: string; amount: number; date: string;
  description: string | null; source: string; attachmentUrl: string | null;
  currency: Currency; category: Category | null;
  account: { id: string; name: string };
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "income")     return <TrendingUp     className={className} />;
  if (type === "expense")    return <TrendingDown   className={className} />;
  if (type === "transfer")   return <ArrowLeftRight className={className} />;
  if (type === "withdrawal") return <Landmark       className={className} />;
  return <TrendingDown className={className} />;
}

export default function AccountLedgerPage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const accountId = params.id;

  const [account, setAccount]           = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterType, setFilterType]     = useState<"all" | TxType>("all");
  const [search, setSearch]             = useState("");

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      const [a, txs] = await Promise.all([
        fetch(`/api/accounts/${accountId}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/transactions?accountId=${accountId}&limit=500`).then(r => r.json()),
      ]);
      if (cancelled) return;
      setAccount(a);
      setTransactions(txs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  // Compute running balance: walk transactions chronologically forward, then sort desc for display
  const txsWithBalance = useMemo(() => {
    if (!account) return [];
    // API returns desc by date — we walk in reverse to compute oldest-first running balance,
    // then reverse back for display.
    const ascending = [...transactions].reverse();
    // Running balance ends at current balance, so we work backwards from current.
    // Simpler approach: start from "balance before earliest" = current - sum(deltas)
    const totalDelta = ascending.reduce((s, tx) => s + delta(tx), 0);
    let running = account.balance - totalDelta; // balance just before earliest tx
    const withRun = ascending.map(tx => {
      running += delta(tx);
      return { ...tx, runningBalance: running };
    });
    return withRun.reverse(); // back to newest first
  }, [transactions, account]);

  // Apply filters (after balance is computed so balance stays consistent)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txsWithBalance.filter(tx => {
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (q) {
        const hay = `${tx.description ?? ""} ${tx.category?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [txsWithBalance, filterType, search]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const tx of filtered) {
      const key = tx.date.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(tx);
      else map.set(key, [tx]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Period summary
  const summary = useMemo(() => {
    const s = { in: 0, out: 0 };
    for (const tx of filtered) {
      const d = delta(tx);
      if (d > 0) s.in += d;
      else       s.out += -d;
    }
    return s;
  }, [filtered]);

  if (loading) {
    return <div className="p-6 text-slate-400 text-sm">Loading account…</div>;
  }
  if (!account) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Account not found.</p>
        <Button variant="outline" onClick={() => router.push("/accounts")} className="mt-3">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to accounts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Top bar with back link */}
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors tap-feedback"
          aria-label="Back to accounts"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate flex items-center gap-2">
            <Wallet className="h-5 w-5 text-slate-400 shrink-0" />
            {account.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">
            {account.type.replace("_", " ")} · {account.currency.code}
          </p>
        </div>
      </div>

      {/* Balance card + summary */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Current Balance</p>
          <p className={`text-3xl md:text-4xl font-bold mt-1 ${account.balance >= 0 ? "text-slate-900" : "text-red-600"}`}>
            {formatAmount(account.balance, account.currency.symbol)}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Money In{filterType !== "all" || search ? " (filtered)" : ""}</p>
              <p className="text-sm font-semibold text-green-600 mt-0.5">
                +{formatAmount(summary.in, account.currency.symbol)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Money Out{filterType !== "all" || search ? " (filtered)" : ""}</p>
              <p className="text-sm font-semibold text-red-500 mt-0.5">
                −{formatAmount(summary.out, account.currency.symbol)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search description or category…"
          className="pl-9 h-10"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type chips */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto pb-1">
        <div className="flex gap-2 min-w-max">
          <Chip active={filterType === "all"} onClick={() => setFilterType("all")} label="All" />
          {TX_TYPES.map(t => (
            <Chip
              key={t.value}
              active={filterType === t.value}
              onClick={() => setFilterType(t.value)}
              label={t.label}
              icon={t.emoji}
            />
          ))}
        </div>
      </div>

      {/* Ledger entries grouped by day */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 px-6">
          <p className="text-slate-500">No transactions match.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, txs]) => (
            <section key={day}>
              <h2 className="sticky top-[56px] md:top-0 z-10 bg-slate-50/95 backdrop-blur-sm py-1.5 px-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {relativeDayLabel(day)}
              </h2>
              <div className="space-y-2 mt-2">
                {txs.map(tx => (
                  <LedgerRow key={tx.id} tx={tx} account={account} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function delta(tx: { type: string; amount: number }): number {
  return tx.type === "income" || tx.type === "transfer-in" ? tx.amount : -tx.amount;
}

function Chip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3.5 rounded-full text-sm font-medium border whitespace-nowrap transition-all tap-feedback
        ${active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
      aria-pressed={active}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </button>
  );
}

function LedgerRow({
  tx, account,
}: {
  tx: Transaction & { runningBalance: number };
  account: Account;
}) {
  const meta = txTypeMeta(tx.type);
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 flex items-center gap-3 card-hover">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
        ${tx.type === "income"     ? "bg-green-50 text-green-600"
        : tx.type === "expense"    ? "bg-red-50 text-red-500"
        : tx.type === "withdrawal" ? "bg-amber-50 text-amber-600"
        :                            "bg-slate-50 text-slate-500"}`}>
        <TypeIcon type={tx.type} className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-medium text-slate-800 truncate">
            {tx.description || meta.label}
          </p>
          {tx.attachmentUrl && (
            <a href={tx.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600 shrink-0" aria-label="View receipt">
              <Paperclip className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {meta.label}{tx.category && <> · {tx.category.name}</>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bold text-sm whitespace-nowrap ${txAmountClass(tx.type)}`}>
          {txAmountPrefix(tx.type)}{formatAmount(tx.amount, tx.currency.symbol)}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
          Bal: {formatAmount(tx.runningBalance, account.currency.symbol)}
        </p>
      </div>
    </div>
  );
}
