"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AmountInput } from "@/components/ui/amount-input";
import { formatAmount, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, Pencil, Filter, Paperclip, X } from "lucide-react";

interface Currency { id: string; code: string; symbol: string }
interface Account { id: string; name: string; currency: Currency }
interface Category { id: string; name: string; type: string }
interface Transaction {
  id: string; type: string; amount: number; date: string; description: string | null; source: string;
  attachmentUrl: string | null;
  currency: Currency; account: Account; category: Category | null;
}

const emptyForm = () => ({ type: "expense", amount: "", accountId: "", categoryId: "", date: new Date().toISOString().slice(0, 10), description: "" });

async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const d = await res.json();
  return d.url as string;
}

export default function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterAccountId, setFilterAccountId] = useState("all");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [txFile, setTxFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAll();
    fetch("/api/accounts").then(r => r.json()).then(setAccounts);
    fetch("/api/categories").then(r => r.json()).then(setCategories);
  }, []);

  function fetchAll() {
    fetch("/api/transactions?limit=200").then(r => r.json()).then(setTransactions);
  }

  function openAdd() { setEditTx(null); setForm(emptyForm()); setTxFile(null); setOpen(true); }
  function openEdit(tx: Transaction) {
    setEditTx(tx);
    setForm({
      type: tx.type, amount: String(tx.amount), accountId: tx.account.id,
      categoryId: tx.category?.id ?? "", date: tx.date.slice(0, 10), description: tx.description ?? "",
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
      toast(editTx ? "Transaction updated" : "Transaction saved");
      setOpen(false); setEditTx(null); setForm(emptyForm()); setTxFile(null); fetchAll();
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to save", "error");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    if (res.ok) { toast("Transaction deleted — account balance reversed"); fetchAll(); }
    else { const d = await res.json(); toast(d.error ?? "Failed to delete", "error"); }
  }

  const selectedAccount = accounts.find(a => a.id === form.accountId);
  const filteredCategories = categories.filter(c => c.type === form.type || c.type === "both");

  const filtered = transactions.filter(tx => {
    if (filterType !== "all" && tx.type !== filterType) return false;
    if (filterAccountId !== "all" && tx.account.id !== filterAccountId) return false;
    if (filterCategoryId !== "all" && tx.category?.id !== filterCategoryId) return false;
    if (dateFrom && tx.date < dateFrom) return false;
    if (dateTo && tx.date > dateTo + "T23:59:59") return false;
    return true;
  });

  const hasActiveFilters = filterType !== "all" || filterAccountId !== "all" || filterCategoryId !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500 text-sm mt-1">Income and expense records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={hasActiveFilters ? "border-blue-300 text-blue-600" : ""}>
            <Filter className="h-4 w-4 mr-1" />Filters{hasActiveFilters ? " •" : ""}
          </Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Transaction</Button>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2">
        {["all", "income", "expense", "transfer"].map(t => (
          <Button key={t} size="sm" variant={filterType === t ? "default" : "outline"} onClick={() => setFilterType(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <Card className="animate-scale-in">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Account</Label>
                <Select value={filterAccountId} onValueChange={setFilterAccountId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Input type="date" className="h-8 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Input type="date" className="h-8 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            {hasActiveFilters && (
              <button className="text-xs text-slate-400 hover:text-slate-600 mt-3 underline" onClick={() => {
                setFilterType("all"); setFilterAccountId("all"); setFilterCategoryId("all"); setDateFrom(""); setDateTo("");
              }}>Clear all filters</button>
            )}
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</p>
      )}

      <Card>
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
                  <th className="text-left p-4 font-medium text-slate-500">Source</th>
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
                            <a
                              href={tx.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View receipt"
                              onClick={e => e.stopPropagation()}
                              className="text-blue-400 hover:text-blue-600 transition-colors"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">{tx.account.name}</td>
                      <td className="p-4">{tx.category ? <Badge variant="secondary">{tx.category.name}</Badge> : "—"}</td>
                      <td className="p-4">{tx.source === "import" ? <Badge variant="outline">Imported</Badge> : <Badge variant="secondary">Manual</Badge>}</td>
                      <td className={`p-4 text-right font-medium whitespace-nowrap ${tx.type === "income" ? "text-green-600" : tx.type === "expense" ? "text-red-500" : "text-slate-500"}`}>
                        {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                        {formatAmount(tx.amount, tx.currency.symbol)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(tx)} className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm(tx.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
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

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditTx(null); setForm(emptyForm()); setTxFile(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTx ? "Edit Transaction" : "New Transaction"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, categoryId: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount {selectedAccount ? `(${selectedAccount.currency.code})` : ""}</Label>
                <AmountInput placeholder="0" value={form.amount}
                  onChange={v => setForm(f => ({ ...f, amount: v }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input placeholder="What was this for?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Receipt / Slip (optional)</Label>
              {editTx?.attachmentUrl && !txFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <a href={editTx.attachmentUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-500 hover:text-blue-700">
                    <Paperclip className="h-4 w-4" />View current attachment
                  </a>
                  <span className="text-slate-300">|</span>
                  <label className="text-slate-500 hover:text-slate-700 cursor-pointer underline text-xs">
                    Replace
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                      onChange={e => setTxFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500 truncate">
                    {txFile ? txFile.name : "Attach JPG, PNG, or PDF (max 5MB)"}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                    onChange={e => setTxFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {txFile && (
                <button type="button" onClick={() => setTxFile(null)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <X className="h-3 w-3" /> Remove file
                </button>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || uploading || !form.amount || !form.accountId}>
                {uploading ? "Uploading..." : loading ? "Saving..." : editTx ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Transaction?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This will permanently delete this transaction and reverse the account balance accordingly.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
