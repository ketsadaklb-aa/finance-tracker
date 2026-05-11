"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AmountInput } from "@/components/ui/amount-input";
import { formatAmount } from "@/lib/utils";
import Link from "next/link";
import { Plus, Wallet, Pencil, Trash2, ChevronRight } from "lucide-react";

interface Currency { id: string; code: string; symbol: string; name: string }
interface Account { id: string; name: string; type: string; balance: number; currency: Currency; note: string | null }

const accountTypes = ["bank", "cash", "credit_card", "wallet"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [open, setOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "bank", balance: "", currencyId: "", note: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetch("/api/currencies").then(r => r.json()).then(setCurrencies);
  }, []);

  function fetchAccounts() {
    fetch("/api/accounts").then(r => r.json()).then(setAccounts);
  }

  function openAdd() {
    setEditAccount(null);
    setForm({ name: "", type: "bank", balance: "", currencyId: "", note: "" });
    setOpen(true);
  }

  function openEdit(a: Account) {
    setEditAccount(a);
    setForm({ name: a.name, type: a.type, balance: String(a.balance), currencyId: a.currency.id, note: a.note ?? "" });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (editAccount) {
      await fetch(`/api/accounts/${editAccount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, type: form.type, balance: parseFloat(form.balance) || 0, note: form.note }),
      });
    } else {
      await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, balance: parseFloat(form.balance) || 0 }),
      });
    }
    setLoading(false);
    setOpen(false);
    setEditAccount(null);
    fetchAccounts();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    fetchAccounts();
  }

  const totalByCurrency = accounts.reduce((acc, a) => {
    const code = a.currency.code;
    if (!acc[code]) acc[code] = { symbol: a.currency.symbol, total: 0 };
    acc[code].total += a.balance;
    return acc;
  }, {} as Record<string, { symbol: string; total: number }>);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your bank accounts, cash, and wallets</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Account</Button>
      </div>

      {/* Summary */}
      {Object.keys(totalByCurrency).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
          {Object.entries(totalByCurrency).map(([code, d]) => (
            <Card key={code} className="animate-fade-in">
              <CardContent className="pt-6">
                <p className="text-xs text-slate-400 uppercase tracking-wide">{code} Total</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatAmount(d.total, d.symbol)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {accounts.length === 0 ? (
          <p className="text-slate-400 text-sm col-span-3">No accounts yet. Add one to get started.</p>
        ) : accounts.map(a => (
          <Card key={a.id} className="animate-fade-in card-hover overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <Link
                  href={`/accounts/${a.id}`}
                  className="flex items-center gap-2 min-w-0 flex-1 group tap-feedback"
                  aria-label={`Open ${a.name} ledger`}
                >
                  <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="truncate group-hover:text-blue-600 transition-colors">{a.name}</span>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="secondary">{a.type.replace("_", " ")}</Badge>
                  <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-1" aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteConfirm(a.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardTitle>
            </CardHeader>
            <Link href={`/accounts/${a.id}`} className="block tap-feedback">
              <CardContent className="cursor-pointer">
                <p className={`text-2xl font-bold ${a.balance >= 0 ? "text-slate-900" : "text-red-600"}`}>
                  {formatAmount(a.balance, a.currency.symbol)}
                </p>
                <p className="text-xs text-slate-400 mt-1">{a.currency.code} · {a.currency.name}</p>
                {a.note && <p className="text-xs text-slate-400 mt-1">{a.note}</p>}
                <p className="text-xs text-blue-500 mt-2 flex items-center gap-0.5 font-medium">
                  View ledger <ChevronRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditAccount(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editAccount ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. BCEL Bank, KBank, Cash" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{accountTypes.map(t => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                {editAccount ? (
                  <Input value={`${editAccount.currency.code} – ${editAccount.currency.name}`} disabled className="bg-slate-50 text-slate-500" />
                ) : (
                  <Select value={form.currencyId} onValueChange={v => setForm(f => ({ ...f, currencyId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{editAccount ? "Balance" : "Opening Balance"}</Label>
              <AmountInput placeholder="0" value={form.balance} onChange={v => setForm(f => ({ ...f, balance: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. savings account" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || !form.name || (!editAccount && !form.currencyId)}>
                {loading ? "Saving..." : editAccount ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Account?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This will permanently delete the account. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
