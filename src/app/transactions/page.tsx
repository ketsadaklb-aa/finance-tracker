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
import {
  Plus, Trash2, Pencil, Filter, Paperclip, X, Search,
  TrendingUp, TrendingDown, ArrowLeftRight, Landmark,
} from "lucide-react";

interface Currency { id: string; code: string; symbol: string }
interface Account { id: string; name: string; currency: Currency }
interface Category { id: string; name: string; type: string }
interface Transaction {
  id: string; type: string; amount: number; date: string; description: string | null; source: string;
  attachmentUrl: string | null;
  currency: Currency; account: Account; category: Category | null;
}

const emptyForm = (defaultAccountId = "") => ({
  type: "expense" as TxType,
  amount: "",
  accountId: defaultAccountId,
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
      categoryId: tx.category?.id ?? "",
      date: tx.date.slice(0, 10),
      description: tx.description ?? "",
    });
    setTxFile(null);
    setOpen(true);
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
      if (filterType !== "all" && tx.type !== filterType) return false;
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

  const hasActiveFilters =
    filterType !== "all" || filterAccountId !== "all" || filterCategoryId !== "all" ||
    !!dateFrom || !!dateTo || !!search;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="hidden sm:block text-slate-500 text-sm mt-1">Income, expense, transfers and withdrawals</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(true)}
            className={hasActiveFilters ? "border-blue-300 text-blue-600" : ""}
            aria-label="Open filters"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Filters{hasActiveFilters ? " •" : ""}</span>
          </Button>
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

      {/* Type filter chips — horizontally scrollable */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          <TypeChip active={filterType === "all"} onClick={() => setFilterType("all")} label="All" />
          {TX_TYPES.map(t => (
            <TypeChip
              key={t.value}
              active={filterType === t.value}
              onClick={() => setFilterType(t.value)}
              label={t.label}
              icon={t.emoji}
            />
          ))}
        </div>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</p>
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
            {grouped.map(([day, txs]) => (
              <section key={day}>
                <h2 className="sticky top-[56px] z-10 bg-slate-50/95 backdrop-blur-sm py-1.5 px-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {relativeDayLabel(day)}
                </h2>
                <div className="space-y-2 mt-2">
                  {txs.map(tx => (
                    <TxCard key={tx.id} tx={tx} onEdit={() => openEdit(tx)} onDelete={() => setDeleteConfirm(tx)} />
                  ))}
                </div>
              </section>
            ))}
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
            {/* Type chips */}
            <div>
              <Label className="text-xs text-slate-500">Type</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
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
                      <TypeIcon type={t.value} className="h-5 w-5" />
                      <span className="text-[11px] font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Big amount input */}
            <div>
              <Label className="text-xs text-slate-500">
                Amount {selectedAccount ? `(${selectedAccount.currency.code})` : ""}
              </Label>
              <AmountInput
                placeholder="0"
                value={form.amount}
                onChange={v => setForm(f => ({ ...f, amount: v }))}
                required
                className="!h-14 !text-2xl !font-bold text-center"
                autoFocus={!editTx}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Account</Label>
                <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Category</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={form.type === "withdrawal" || form.type === "transfer" ? "Optional" : "Select…"} /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.length === 0
                      ? <SelectItem value="__none__" disabled>No categories for {form.type}</SelectItem>
                      : filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
              <Button type="submit" disabled={loading || uploading || !form.amount || !form.accountId} className="h-11">
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

function TypeChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: string }) {
  return (
    <button
      type="button"
      onClick={() => { haptic(5); onClick(); }}
      className={`h-9 px-3.5 rounded-full text-sm font-medium border whitespace-nowrap transition-all tap-feedback
        ${active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
      aria-pressed={active}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </button>
  );
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "income")     return <TrendingUp className={className} />;
  if (type === "expense")    return <TrendingDown className={className} />;
  if (type === "transfer")   return <ArrowLeftRight className={className} />;
  if (type === "withdrawal") return <Landmark className={className} />;
  return <TrendingDown className={className} />;
}

function TypeBadge({ type }: { type: string }) {
  const meta = txTypeMeta(type);
  const bg =
    type === "income"     ? "bg-green-50 text-green-700 border-green-200"
  : type === "expense"    ? "bg-red-50 text-red-700 border-red-200"
  : type === "withdrawal" ? "bg-amber-50 text-amber-700 border-amber-200"
  :                         "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${bg}`}>
      <TypeIcon type={type} className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function TxCard({ tx, onEdit, onDelete }: { tx: Transaction; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = txTypeMeta(tx.type);
  return (
    <div
      className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden card-hover"
      onClick={() => setExpanded(e => !e)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(x => !x); } }}
    >
      <div className="p-3.5 flex items-center gap-3">
        {/* Type emoji bubble */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0
          ${tx.type === "income" ? "bg-green-50" :
            tx.type === "expense" ? "bg-red-50" :
            tx.type === "withdrawal" ? "bg-amber-50" : "bg-slate-50"}`}>
          {meta.emoji}
        </div>
        {/* Description + account */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 truncate">
            {tx.description || meta.label}
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {tx.account.name}
            {tx.category && <> · {tx.category.name}</>}
          </p>
        </div>
        {/* Amount */}
        <div className="text-right shrink-0">
          <p className={`font-bold text-sm whitespace-nowrap ${txAmountClass(tx.type)}`}>
            {txAmountPrefix(tx.type)}{formatAmount(tx.amount, tx.currency.symbol)}
          </p>
          {tx.attachmentUrl && (
            <span className="inline-flex items-center text-blue-400 mt-0.5">
              <Paperclip className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
      {/* Expanded actions */}
      {expanded && (
        <div className="border-t border-slate-100 flex divide-x divide-slate-100 animate-fade-in">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="flex-1 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 tap-feedback"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          {tx.attachmentUrl && (
            <a
              href={tx.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex-1 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 tap-feedback"
            >
              <Paperclip className="h-3.5 w-3.5" /> Receipt
            </a>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="flex-1 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 tap-feedback"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
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
