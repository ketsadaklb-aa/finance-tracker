"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetFooter, BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AmountInput } from "@/components/ui/amount-input";
import {
  formatAmount, formatDate, relativeDayLabel,
  TX_TYPES, type TxType, txAmountClass, txAmountPrefix, txTypeMeta,
} from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { TxTypeIcon, txTypeBubbleClass } from "@/components/ui/tx-type-icon";
import { Plus, Trash2, Pencil, Filter, Paperclip, X, Search, ArrowLeftRight, Copy, Check, Circle, CheckSquare } from "lucide-react";

interface Currency { id: string; code: string; symbol: string }
interface Account { id: string; name: string; currency: Currency }
interface Category { id: string; name: string; type: string }
interface Transaction {
  id: string; type: string; amount: number; date: string; description: string | null; source: string;
  attachmentUrl: string | null;
  createdAt: string; updatedAt: string;
  transferGroupId: string | null;
  currency: Currency; account: Account; category: Category | null;
}

const emptyForm = (defaultAccountId = "") => ({
  type: "expense" as TxType,
  amount: "",
  accountId: defaultAccountId,
  toAccountId: "",            // only used for type === "transfer"
  categoryId: "",
  date: new Date().toISOString().slice(0, 10),
  description: "",
});

const haptic = (ms = 8) => { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms); };

async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const d = await res.json();
  return d.url as string;
}

// ─── Date quick-pick helpers ───────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<"all" | TxType>("all");
  const [filterAccountId, setFilterAccountId] = useState("all");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [txFile, setTxFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Multi-select state: when ≥1 selected, an action bar appears
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const lastAccountIdRef = useRef<string>("");

  const fetchAll = useCallback(() => {
    fetch("/api/transactions?limit=200").then(r => r.json()).then(setTransactions);
  }, []);

  useEffect(() => {
    fetchAll();
    fetch("/api/accounts").then(r => r.json()).then((a: Account[]) => {
      setAccounts(a);
      // Remember the most-recently-used account for smart default
      const stored = typeof window !== "undefined" ? localStorage.getItem("ft_last_account") : null;
      if (stored && a.some(x => x.id === stored)) lastAccountIdRef.current = stored;
      else if (a[0]) lastAccountIdRef.current = a[0].id;
    });
    fetch("/api/categories").then(r => r.json()).then(setCategories);
  }, [fetchAll]);

  const openAdd = useCallback(() => {
    haptic(10);
    setEditTx(null);
    setForm(emptyForm(lastAccountIdRef.current));
    setTxFile(null);
    setOpen(true);
  }, []);

  // Listen for the bottom-nav "+" button
  useEffect(() => {
    const handler = () => openAdd();
    window.addEventListener("openAddTransaction", handler);
    return () => window.removeEventListener("openAddTransaction", handler);
  }, [openAdd]);

  function openEdit(tx: Transaction) {
    haptic(8);
    setEditTx(tx);
    setForm({
      type: tx.type as TxType,
      amount: String(tx.amount),
      accountId: tx.account.id,
      toAccountId: "",
      categoryId: tx.category?.id ?? "",
      date: tx.date.slice(0, 10),
      description: tx.description ?? "",
    });
    setTxFile(null);
    setOpen(true);
  }

  /** Clone a transaction — opens the add sheet pre-filled with the source values, today's date. */
  function duplicateTx(tx: Transaction) {
    haptic(8);
    setEditTx(null);
    const cloneType = tx.type === "transfer-in" || tx.type === "transfer-out" ? "transfer" : (tx.type as TxType);
    setForm({
      type: cloneType,
      amount: String(tx.amount),
      accountId: tx.account.id,
      toAccountId: "",
      categoryId: tx.category?.id ?? "",
      date: new Date().toISOString().slice(0, 10),
      description: tx.description ?? "",
    });
    setTxFile(null);
    setOpen(true);
  }

  const editingTransferLeg = !!editTx && (editTx.type === "transfer-out" || editTx.type === "transfer-in");

  // ─── Multi-select handlers ───────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    haptic(20);
    const ids = Array.from(selectedIds);
    const snapshot = transactions;
    // Optimistic remove
    setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
    clearSelection();

    let undone = false;
    toast(`${ids.length} transaction${ids.length === 1 ? "" : "s"} deleted`, "success", {
      action: { label: "Undo", onClick: () => { undone = true; setTransactions(snapshot); } },
      duration: 5500,
    });

    setTimeout(async () => {
      if (undone) return;
      const results = await Promise.all(
        ids.map(id => fetch(`/api/transactions/${id}`, { method: "DELETE" }).then(r => r.ok)),
      );
      const failed = results.filter(ok => !ok).length;
      if (failed > 0) {
        setTransactions(snapshot);
        toast(`${failed} failed to delete — restored`, "error");
      }
    }, 5500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let attachmentUrl: string | null | undefined = undefined;
    if (txFile) {
      setUploading(true);
      const uploaded = await uploadFile(txFile);
      setUploading(false);
      if (!uploaded) {
        toast("File upload failed", "error");
        setLoading(false);
        return;
      }
      attachmentUrl = uploaded;
    }

    const url = editTx ? `/api/transactions/${editTx.id}` : "/api/transactions";
    const method = editTx ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        categoryId: form.categoryId || null,
        ...(attachmentUrl !== undefined && { attachmentUrl }),
      }),
    });
    setLoading(false);
    if (res.ok) {
      haptic(15);
      // Remember the account for next time
      if (form.accountId) {
        localStorage.setItem("ft_last_account", form.accountId);
        lastAccountIdRef.current = form.accountId;
      }
      toast(editTx ? "Transaction updated" : "Transaction saved");
      setOpen(false); setEditTx(null); setForm(emptyForm()); setTxFile(null); fetchAll();
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to save", "error");
    }
  }

  // Optimistic delete with undo
  async function handleDelete(tx: Transaction) {
    haptic(20);
    setDeleteConfirm(null);

    // Optimistically remove from UI
    const snapshot = transactions;
    setTransactions(prev => prev.filter(t => t.id !== tx.id));

    let undone = false;
    toast("Transaction deleted", "success", {
      action: { label: "Undo", onClick: () => { undone = true; setTransactions(snapshot); } },
      duration: 5500,
    });

    // Wait briefly to allow undo; commit deletion if not undone
    setTimeout(async () => {
      if (undone) return;
      const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
      if (!res.ok) {
        // Restore on failure
        setTransactions(snapshot);
        toast("Failed to delete — restored", "error");
      }
    }, 5500);
  }

  const selectedAccount = accounts.find(a => a.id === form.accountId);
  const filteredCategories = useMemo(
    () => categories.filter(c => c.type === form.type || c.type === "both"),
    [categories, form.type]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter(tx => {
      if (filterType !== "all") {
        // "transfer" filter matches both legs; "other" filter matches other-in + other-out
        if (filterType === "transfer") {
          if (tx.type !== "transfer" && tx.type !== "transfer-in" && tx.type !== "transfer-out") return false;
        } else if (filterType === "other-in" || filterType === "other-out" || (filterType as string) === "other") {
          if (tx.type !== "other-in" && tx.type !== "other-out") return false;
        } else if (tx.type !== filterType) {
          return false;
        }
      }
      if (filterAccountId !== "all" && tx.account.id !== filterAccountId) return false;
      if (filterCategoryId !== "all" && tx.category?.id !== filterCategoryId) return false;
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo + "T23:59:59") return false;
      if (q) {
        const hay = `${tx.description ?? ""} ${tx.account.name} ${tx.category?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterAccountId, filterCategoryId, dateFrom, dateTo, search]);

  // Group by date (ISO yyyy-mm-dd) for the mobile day-grouped list
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      const key = tx.date.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(tx);
      else map.set(key, [tx]);
    }
    // Already sorted by date desc from API
    return Array.from(map.entries());
  }, [filtered]);

  const activeFilterCount =
    (filterType !== "all" ? 1 : 0) +
    (filterAccountId !== "all" ? 1 : 0) +
    (filterCategoryId !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (search ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // Per-type breakdown chip counts for the active filter set
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tx of filtered) {
      const t = tx.type === "transfer-in" || tx.type === "transfer-out" ? "transfer" : tx.type;
      const grouped = (t === "other-in" || t === "other-out") ? "other" : t;
      counts[grouped] = (counts[grouped] ?? 0) + 1;
    }
    return counts;
  }, [filtered]);

  // Per-day totals (signed delta in account currency — best-effort: aggregate by currency)
  const dayTotals = useMemo(() => {
    const out = new Map<string, { in: number; out: number; symbol: string }>();
    for (const tx of filtered) {
      const key = tx.date.slice(0, 10);
      const cur = out.get(key) ?? { in: 0, out: 0, symbol: tx.currency.symbol };
      const isIn = tx.type === "income" || tx.type === "transfer-in" || tx.type === "other-in";
      if (isIn) cur.in += tx.amount;
      else      cur.out += tx.amount;
      out.set(key, cur);
    }
    return out;
  }, [filtered]);

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Multi-select floating action bar — fixed bottom (above mobile bottom nav) */}
      {selectMode && (
        <div className="fixed bottom-[80px] left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:bottom-6 md:max-w-md md:right-auto z-50 animate-fade-in">
          <div className="bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-600/40 px-3 py-2.5 flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="font-semibold text-sm flex-1">{selectedIds.size} selected</span>
            <button
              onClick={() => setSelectedIds(new Set(filtered.map(t => t.id)))}
              className="text-xs font-medium px-2 py-1 rounded-lg hover:bg-white/15 transition-colors flex items-center gap-1"
            >
              <CheckSquare className="h-3.5 w-3.5" /> All
            </button>
            <button
              onClick={bulkDelete}
              className="bg-white/15 hover:bg-white/25 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="hidden sm:block text-slate-500 text-sm mt-1">Income, expense, transfers and withdrawals</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className={`relative inline-flex items-center justify-center h-9 px-3 rounded-xl border-2 text-sm font-semibold transition-all tap-feedback
              ${hasActiveFilters
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"}`}
            aria-label={hasActiveFilters ? `${activeFilterCount} filters active` : "Open filters"}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Filters</span>
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <Button onClick={openAdd} size="sm" className="hidden sm:inline-flex">
            <Plus className="h-4 w-4 mr-1" />Add Transaction
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search description, account, category…"
          className="pl-9 h-10"
          aria-label="Search transactions"
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

      {/* Type filter chips — combined "Other" replaces other-in/other-out for cleaner UX */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          <TypeChip active={filterType === "all"} onClick={() => setFilterType("all")} label="All" />
          <TypeChip active={filterType === "income"}     onClick={() => setFilterType("income")}     label="Income"     iconType="income" />
          <TypeChip active={filterType === "expense"}    onClick={() => setFilterType("expense")}    label="Expense"    iconType="expense" />
          <TypeChip active={filterType === "transfer"}   onClick={() => setFilterType("transfer")}   label="Transfer"   iconType="transfer" />
          <TypeChip active={filterType === "withdrawal"} onClick={() => setFilterType("withdrawal")} label="Withdrawal" iconType="withdrawal" />
          <TypeChip
            active={filterType === "other-in" || filterType === "other-out"}
            onClick={() => setFilterType("other-in")}
            label="Other"
            iconType="other-in"
          />
        </div>
      </div>

      {/* Tx count breakdown — replaces the flat "5 transactions" line */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
          <span className="font-medium">{filtered.length} {filtered.length === 1 ? "transaction" : "transactions"}</span>
          {typeCounts.income     > 0 && <CountChip color="emerald" count={typeCounts.income}     label="income" />}
          {typeCounts.expense    > 0 && <CountChip color="rose"    count={typeCounts.expense}    label="expense" />}
          {typeCounts.transfer   > 0 && <CountChip color="sky"     count={typeCounts.transfer}   label="transfer" />}
          {typeCounts.withdrawal > 0 && <CountChip color="amber"   count={typeCounts.withdrawal} label="withdrawal" />}
          {typeCounts.other      > 0 && <CountChip color="teal"    count={typeCounts.other}      label="other" />}
        </div>
      )}

      {/* Mobile: cards grouped by day */}
      <div className="md:hidden">
        {filtered.length === 0 ? (
          <EmptyState onAdd={openAdd} hasFilters={hasActiveFilters} onClearFilters={() => {
            setFilterType("all"); setFilterAccountId("all"); setFilterCategoryId("all");
            setDateFrom(""); setDateTo(""); setSearch("");
          }} />
        ) : (
          <div className="space-y-4">
            {grouped.map(([day, txs]) => {
              const totals = dayTotals.get(day);
              return (
                <section key={day}>
                  <header className="sticky top-[56px] z-10 bg-slate-50/95 backdrop-blur-sm py-2 px-1 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-700">
                      {relativeDayLabel(day)}
                    </h2>
                    {totals && (
                      <p className="text-[11px] font-medium tracking-tight tabular-nums">
                        {totals.in > 0 && <span className="text-emerald-600">+{totals.symbol}{Math.round(totals.in).toLocaleString()}</span>}
                        {totals.in > 0 && totals.out > 0 && <span className="text-slate-300 mx-1">·</span>}
                        {totals.out > 0 && <span className="text-rose-500">−{totals.symbol}{Math.round(totals.out).toLocaleString()}</span>}
                      </p>
                    )}
                  </header>
                  <div className="space-y-2 mt-2">
                    {txs.map(tx => (
                      <TxCard
                        key={tx.id}
                        tx={tx}
                        onEdit={() => openEdit(tx)}
                        onDelete={() => setDeleteConfirm(tx)}
                        onDuplicate={() => duplicateTx(tx)}
                        selectMode={selectMode}
                        selected={selectedIds.has(tx.id)}
                        onToggleSelect={() => toggleSelect(tx.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-slate-400 text-sm">No transactions found.</p>
              <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add your first transaction</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left p-4 font-medium text-slate-500">Date</th>
                  <th className="text-left p-4 font-medium text-slate-500">Description</th>
                  <th className="text-left p-4 font-medium text-slate-500">Account</th>
                  <th className="text-left p-4 font-medium text-slate-500">Category</th>
                  <th className="text-left p-4 font-medium text-slate-500">Type</th>
                  <th className="text-right p-4 font-medium text-slate-500">Amount</th>
                  <th className="p-4"></th>
                </tr></thead>
                <tbody>
                  {filtered.map(tx => (
                    <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50 group">
                      <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="p-4 text-slate-700">
                        <span className="flex items-center gap-1.5">
                          {tx.description || "—"}
                          {tx.attachmentUrl && (
                            <a href={tx.attachmentUrl} target="_blank" rel="noopener noreferrer"
                              title="View receipt" onClick={e => e.stopPropagation()}
                              className="text-blue-400 hover:text-blue-600 transition-colors">
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">{tx.account.name}</td>
                      <td className="p-4">{tx.category ? <Badge variant="secondary">{tx.category.name}</Badge> : "—"}</td>
                      <td className="p-4"><TypeBadge type={tx.type} /></td>
                      <td className={`p-4 text-right font-medium whitespace-nowrap ${txAmountClass(tx.type)}`}>
                        {txAmountPrefix(tx.type)}{formatAmount(tx.amount, tx.currency.symbol)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(tx)} className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm(tx)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit — bottom sheet on mobile, modal on desktop */}
      <BottomSheet open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditTx(null); setForm(emptyForm()); setTxFile(null); } }}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>{editTx ? "Edit Transaction" : "New Transaction"}</BottomSheetTitle>
          </BottomSheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingTransferLeg && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
                Transfer legs are paired. Only <strong>date</strong>, <strong>description</strong> and <strong>receipt</strong> can be edited.
                To change amount or accounts, delete this transfer and create a new one.
              </div>
            )}

            {/* Type chips — hidden when editing a transfer leg */}
            {!editingTransferLeg && (
              <div>
                <Label className="text-xs text-slate-500">Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {TX_TYPES.map(t => {
                    const active = form.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { haptic(6); setForm(f => ({ ...f, type: t.value, categoryId: "" })); }}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all tap-feedback
                          ${active
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                        aria-pressed={active}
                      >
                        <TxTypeIcon type={t.value} className="h-5 w-5" />
                        <span className="text-[11px] font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                {(form.type === "other-in" || form.type === "other-out") && (
                  <p className="text-[11px] text-slate-500 mt-2 leading-snug">
                    For money in/out that isn&apos;t real income or spending — e.g. refunds, asset sales, money you&apos;re holding for someone, loans received/repaid. Affects your balance but excluded from income/expense reports.
                  </p>
                )}
              </div>
            )}

            {/* Big amount input — read-only for transfer legs */}
            <div>
              <Label className="text-xs text-slate-500">
                Amount {selectedAccount ? `(${selectedAccount.currency.code})` : ""}
              </Label>
              <AmountInput
                placeholder="0"
                value={form.amount}
                onChange={v => setForm(f => ({ ...f, amount: v }))}
                required
                disabled={editingTransferLeg}
                className="!h-14 !text-2xl !font-bold text-center disabled:opacity-60"
                autoFocus={!editTx}
              />
            </div>

            {form.type === "transfer" && !editingTransferLeg ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">From account</Label>
                  <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Source…" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id} disabled={a.id === form.toAccountId}>
                          {a.name} ({a.currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">To account</Label>
                  <Select value={form.toAccountId} onValueChange={v => setForm(f => ({ ...f, toAccountId: v }))}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Destination…" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id} disabled={a.id === form.accountId}>
                          {a.name} ({a.currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Account</Label>
                  <Select
                    value={form.accountId}
                    onValueChange={v => setForm(f => ({ ...f, accountId: v }))}
                    disabled={editingTransferLeg}
                  >
                    <SelectTrigger className="h-11 disabled:opacity-60"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {!editingTransferLeg && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Category</Label>
                    <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                      <SelectTrigger className="h-11"><SelectValue placeholder={(form.type === "withdrawal" || form.type === "other-in" || form.type === "other-out") ? "Optional" : "Select…"} /></SelectTrigger>
                      <SelectContent>
                        {filteredCategories.length === 0
                          ? <SelectItem value="__none__" disabled>No categories for {form.type}</SelectItem>
                          : filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Date quick-picks */}
            <div>
              <Label className="text-xs text-slate-500">Date</Label>
              <div className="flex gap-2 mt-1.5">
                <button type="button" onClick={() => setForm(f => ({ ...f, date: todayISO() }))}
                  className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-colors tap-feedback ${form.date === todayISO() ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  Today
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, date: yesterdayISO() }))}
                  className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-colors tap-feedback ${form.date === yesterdayISO() ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  Yesterday
                </button>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                  className="!w-auto !h-10 flex-1 min-w-0"
                  aria-label="Custom date"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Description (optional)</Label>
              <Input
                placeholder="What was this for?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Receipt / Slip (optional)</Label>
              {editTx?.attachmentUrl && !txFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <a href={editTx.attachmentUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-500 hover:text-blue-700">
                    <Paperclip className="h-4 w-4" />View current attachment
                  </a>
                  <span className="text-slate-300">|</span>
                  <label className="text-slate-500 hover:text-slate-700 cursor-pointer underline text-xs">
                    Replace
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="hidden"
                      onChange={e => setTxFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-3 hover:bg-slate-50 transition-colors">
                  <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500 truncate">
                    {txFile ? txFile.name : "Attach photo or PDF (max 5MB)"}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="hidden"
                    onChange={e => setTxFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {txFile && (
                <button type="button" onClick={() => setTxFile(null)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <X className="h-3 w-3" /> Remove file
                </button>
              )}
            </div>

            <BottomSheetFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11">Cancel</Button>
              <Button
                type="submit"
                disabled={
                  loading ||
                  uploading ||
                  !form.amount ||
                  !form.accountId ||
                  (form.type === "transfer" && (!form.toAccountId || form.toAccountId === form.accountId))
                }
                className="h-11"
              >
                {uploading ? "Uploading…" : loading ? "Saving…" : editTx ? "Update" : "Save"}
              </Button>
            </BottomSheetFooter>
          </form>
        </BottomSheetContent>
      </BottomSheet>

      {/* Filters — bottom sheet */}
      <BottomSheet open={showFilters} onOpenChange={setShowFilters}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>Filters</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Account</Label>
              <Select value={filterAccountId} onValueChange={setFilterAccountId}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Category</Label>
              <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">From</Label>
                <Input type="date" className="h-11" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">To</Label>
                <Input type="date" className="h-11" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            {hasActiveFilters && (
              <button
                className="w-full h-11 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
                onClick={() => {
                  setFilterAccountId("all"); setFilterCategoryId("all");
                  setDateFrom(""); setDateTo(""); setSearch("");
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
          <BottomSheetFooter>
            <Button onClick={() => setShowFilters(false)} className="h-11 w-full sm:w-auto">Done</Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>

      {/* Delete confirm — small centered dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Transaction?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">
            This will permanently delete this transaction and reverse the account balance.
            You&apos;ll have a few seconds to undo from the toast notification.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function TypeChip({
  active, onClick, label, iconType,
}: {
  active: boolean; onClick: () => void; label: string; iconType?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { haptic(5); onClick(); }}
      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium border whitespace-nowrap transition-all tap-feedback
        ${active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30 scale-[1.02]"
          : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"}`}
      aria-pressed={active}
    >
      {iconType && <TxTypeIcon type={iconType} className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function TypeBadge({ type }: { type: string }) {
  const meta = txTypeMeta(type);
  const bg =
    type === "income"       ? "bg-green-50 text-green-700 border-green-200"
  : type === "expense"      ? "bg-red-50 text-red-700 border-red-200"
  : type === "withdrawal"   ? "bg-amber-50 text-amber-700 border-amber-200"
  : type === "transfer-in"  ? "bg-blue-50 text-blue-700 border-blue-200"
  : type === "transfer-out" ? "bg-slate-100 text-slate-700 border-slate-300"
  :                           "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${bg}`}>
      <TxTypeIcon type={type} className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function TxCard({
  tx, onEdit, onDelete, onDuplicate, selectMode, selected, onToggleSelect,
}: {
  tx: Transaction;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = txTypeMeta(tx.type);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strip "(XXX)" currency suffix from account name for cleaner display
  const accountClean = tx.account.name.replace(/\s*\([A-Z]{3,4}\)\s*$/, "");

  const handlePointerDown = () => {
    if (selectMode) return;
    longPressTimer.current = setTimeout(() => {
      haptic(20);
      onToggleSelect?.();
    }, 450);
  };
  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleCardClick = () => {
    if (selectMode) { onToggleSelect?.(); return; }
    setExpanded(e => !e);
  };

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden transition-all
        ${selected
          ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
          : "border-slate-100 shadow-sm card-hover focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-300"}`}
      onClick={handleCardClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } }}
    >
      <div className="p-3.5 flex items-center gap-3">
        {/* Selection checkbox or type icon bubble */}
        {selectMode ? (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
            ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"}`}>
            {selected ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
          </div>
        ) : (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${txTypeBubbleClass(tx.type)}`}>
            <TxTypeIcon type={tx.type} className="h-5 w-5" />
          </div>
        )}
        {/* Description + account · category */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate text-[15px] leading-tight flex items-center gap-1.5">
            <span className="truncate">{tx.description || meta.label}</span>
            {tx.source === "import" && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">imp</span>
            )}
            {wasEdited(tx) && (
              <span className="text-[9px] uppercase tracking-wider font-medium text-slate-400 shrink-0">edited</span>
            )}
          </p>
          <p className="text-xs text-slate-500 truncate mt-1">
            {accountClean}
            {tx.category && <> · {tx.category.name}</>}
          </p>
        </div>
        {/* Amount — boosted typography */}
        <div className="text-right shrink-0">
          <p className={`font-bold text-base whitespace-nowrap tracking-tight tabular-nums ${txAmountClass(tx.type)}`}>
            {txAmountPrefix(tx.type)}{formatAmount(tx.amount, tx.currency.symbol)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{timeOfDay(tx.createdAt)}</p>
        </div>
      </div>

      {/* Expanded details + actions — hidden in select mode */}
      {expanded && !selectMode && (
        <div className="border-t border-slate-100 animate-fade-in">
          {/* Detail rows */}
          <dl className="px-3.5 py-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            {tx.description && tx.description.length > 40 && (
              <>
                <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px] pt-0.5">Full description</dt>
                <dd className="text-slate-700 whitespace-pre-wrap break-words">{tx.description}</dd>
              </>
            )}
            <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px] pt-0.5">Type</dt>
            <dd className="text-slate-700 font-medium">{meta.label}</dd>

            <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px] pt-0.5">Account</dt>
            <dd className="text-slate-700 font-medium">{tx.account.name}</dd>

            {tx.category && (
              <>
                <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px] pt-0.5">Category</dt>
                <dd className="text-slate-700 font-medium">{tx.category.name}</dd>
              </>
            )}

            <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px] pt-0.5">Date · Time</dt>
            <dd className="text-slate-700 font-medium">{fullDateTime(tx.date, tx.createdAt)}</dd>

            <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px] pt-0.5">Source</dt>
            <dd className="text-slate-700 font-medium capitalize">{tx.source}</dd>

            {tx.transferGroupId && (
              <>
                <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px] pt-0.5">Transfer pair</dt>
                <dd className="text-slate-700 font-medium">Linked to another leg (deleting will remove both)</dd>
              </>
            )}

            {wasEdited(tx) && (
              <>
                <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px] pt-0.5">Last edited</dt>
                <dd className="text-slate-500 font-medium">{relativeFromNow(tx.updatedAt)}</dd>
              </>
            )}
          </dl>

          {/* Receipt preview — image or paperclip link */}
          {tx.attachmentUrl && (
            <div className="px-3.5 pb-3">
              <a
                href={tx.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="block rounded-lg border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all"
              >
                {isImageUrl(tx.attachmentUrl) ? (
                  // Next/Image would need allowed remote hosts; safer to use plain img for arbitrary URLs
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tx.attachmentUrl} alt="Receipt" className="w-full max-h-56 object-contain bg-slate-50" />
                ) : (
                  <div className="px-3 py-2.5 bg-slate-50 text-sm text-slate-600 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-blue-500" />
                    View attached file
                  </div>
                )}
              </a>
            </div>
          )}

          {/* Action buttons */}
          <div className="border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100">
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 tap-feedback"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            {onDuplicate ? (
              <button
                onClick={e => { e.stopPropagation(); onDuplicate(); }}
                className="py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 tap-feedback"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </button>
            ) : <span />}
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 tap-feedback"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Date/time helpers (used by TxCard) ─────────────────────────────────
function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function fullDateTime(dateIso: string, createdAtIso: string): string {
  const date = new Date(dateIso);
  const created = new Date(createdAtIso);
  const dateStr = date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const timeStr = created.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${dateStr} · ${timeStr}`;
}
function relativeFromNow(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30)  return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}
function wasEdited(tx: { createdAt: string; updatedAt: string }): boolean {
  // Consider "edited" only if updated > 1 minute after creation
  return new Date(tx.updatedAt).getTime() - new Date(tx.createdAt).getTime() > 60_000;
}
function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(url);
}

function CountChip({ color, count, label }: { color: "emerald" | "rose" | "sky" | "amber" | "teal"; count: number; label: string }) {
  const cls = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose:    "bg-rose-50 text-rose-700",
    sky:     "bg-sky-50 text-sky-700",
    amber:   "bg-amber-50 text-amber-700",
    teal:    "bg-teal-50 text-teal-700",
  }[color];
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>{count} {label}</span>;
}

function EmptyState({
  onAdd, hasFilters, onClearFilters,
}: { onAdd: () => void; hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
        <ArrowLeftRight className="h-7 w-7 text-blue-400" />
      </div>
      <p className="text-slate-700 font-medium mb-1">
        {hasFilters ? "No matches" : "No transactions yet"}
      </p>
      <p className="text-slate-500 text-sm mb-5">
        {hasFilters ? "Try clearing your filters or search." : "Add your first one to start tracking."}
      </p>
      {hasFilters ? (
        <Button variant="outline" onClick={onClearFilters}>Clear filters</Button>
      ) : (
        <Button onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Add transaction</Button>
      )}
    </div>
  );
}
