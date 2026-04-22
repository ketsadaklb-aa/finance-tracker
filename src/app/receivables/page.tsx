"use client";
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatAmount, formatDate, getAgingLabel } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, AlertCircle, CheckCircle2, X, Paperclip, Upload } from "lucide-react";

interface Currency { id: string; code: string; symbol: string }
interface Contact { id: string; name: string }
interface Payment { id: string; amount: number; date: string; note: string | null; currency: Currency; attachmentUrl: string | null }
interface Receivable {
  id: string; originalAmount: number; paidAmount: number; remainingAmount: number;
  status: string; description: string | null; agreementDate: string; dueDate: string | null; note: string | null;
  attachmentUrl: string | null;
  contact: Contact; currency: Currency; payments: Payment[];
}

const statusVariant: Record<string, "destructive" | "warning" | "success"> = {
  open: "destructive", partial: "warning", settled: "success",
};

const emptyForm = () => ({ contactId: "", currencyId: "", originalAmount: "", description: "", agreementDate: new Date().toISOString().slice(0, 10), dueDate: "", note: "" });

async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const d = await res.json();
  return d.url as string;
}

export default function ReceivablesPage() {
  const { toast } = useToast();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [open, setOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Receivable | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [payForm, setPayForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), note: "" });
  const [payFile, setPayFile] = useState<File | null>(null);
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  // For attaching a slip to an existing payment
  const [attachingPayment, setAttachingPayment] = useState<{ receivableId: string; paymentId: string } | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAll();
    fetch("/api/contacts").then(r => r.json()).then(setContacts);
    fetch("/api/currencies").then(r => r.json()).then(setCurrencies);
  }, []);

  function fetchAll() {
    fetch("/api/receivables").then(r => r.json()).then(setReceivables);
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openAdd() { setEditRecord(null); setForm(emptyForm()); setRecordFile(null); setOpen(true); }
  function openEdit(r: Receivable) {
    setEditRecord(r);
    setForm({
      contactId: r.contact.id, currencyId: r.currency.id,
      originalAmount: String(r.originalAmount), description: r.description ?? "",
      agreementDate: r.agreementDate.slice(0, 10), dueDate: r.dueDate?.slice(0, 10) ?? "", note: r.note ?? "",
    });
    setRecordFile(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let attachmentUrl: string | null | undefined = undefined;
    if (recordFile) {
      setUploading(true);
      const uploaded = await uploadFile(recordFile);
      setUploading(false);
      if (!uploaded) { toast("File upload failed", "error"); setLoading(false); return; }
      attachmentUrl = uploaded;
    }
    const url = editRecord ? `/api/receivables/${editRecord.id}` : "/api/receivables";
    const method = editRecord ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        originalAmount: parseFloat(form.originalAmount),
        ...(attachmentUrl !== undefined && { attachmentUrl }),
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast(editRecord ? "Receivable updated" : "Receivable created");
      setOpen(false); setEditRecord(null); setForm(emptyForm()); setRecordFile(null); fetchAll();
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to save", "error");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/receivables/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    if (res.ok) { toast("Receivable deleted"); fetchAll(); }
    else { const d = await res.json(); toast(d.error ?? "Failed to delete", "error"); }
  }

  async function handleMarkSettled(r: Receivable) {
    const res = await fetch(`/api/receivables/${r.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: r.remainingAmount, date: new Date().toISOString().slice(0, 10), note: "Marked as settled" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setReceivables(prev => prev.map(x => x.id === r.id ? updated : x));
      toast("Marked as settled");
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed", "error");
    }
  }

  async function handlePayment(receivableId: string) {
    setLoading(true);
    let attachmentUrl: string | null = null;
    if (payFile) {
      setUploading(true);
      attachmentUrl = await uploadFile(payFile);
      setUploading(false);
      if (!attachmentUrl) {
        toast("File upload failed", "error");
        setLoading(false);
        return;
      }
    }
    const res = await fetch(`/api/receivables/${receivableId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(payForm.amount), date: payForm.date, note: payForm.note, attachmentUrl }),
    });
    setLoading(false);
    if (res.ok) {
      const updated = await res.json();
      setReceivables(prev => prev.map(r => r.id === receivableId ? updated : r));
      toast("Payment logged");
      setPayOpen(null);
      setPayForm({ amount: "", date: new Date().toISOString().slice(0, 10), note: "" });
      setPayFile(null);
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to log payment", "error");
    }
  }

  async function handleDeletePayment(receivableId: string, paymentId: string) {
    const res = await fetch(`/api/receivables/${receivableId}/payments/${paymentId}`, { method: "DELETE" });
    if (res.ok) {
      const updated = await res.json();
      setReceivables(prev => prev.map(r => r.id === receivableId ? updated : r));
      toast("Payment removed");
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to remove payment", "error");
    }
  }

  function triggerAttach(receivableId: string, paymentId: string) {
    setAttachingPayment({ receivableId, paymentId });
    attachInputRef.current?.click();
  }

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !attachingPayment) return;
    e.target.value = "";
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (!url) { toast("File upload failed", "error"); setAttachingPayment(null); return; }
    const { receivableId, paymentId } = attachingPayment;
    const res = await fetch(`/api/receivables/${receivableId}/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrl: url }),
    });
    setAttachingPayment(null);
    if (res.ok) {
      setReceivables(prev => prev.map(r => r.id === receivableId ? {
        ...r,
        payments: r.payments.map(p => p.id === paymentId ? { ...p, attachmentUrl: url } : p),
      } : r));
      toast("Slip attached");
    } else {
      toast("Failed to attach slip", "error");
    }
  }

  const filtered = filterStatus === "all" ? receivables : receivables.filter(r => r.status === filterStatus);
  const grouped = filtered.reduce((acc, r) => {
    const key = r.contact.id;
    if (!acc[key]) acc[key] = { contact: r.contact, items: [] };
    acc[key].items.push(r);
    return acc;
  }, {} as Record<string, { contact: Contact; items: Receivable[] }>);

  const now = new Date();
  const isOverdue = (r: Receivable) => r.dueDate && new Date(r.dueDate) < now && r.status !== "settled";

  const contactTotals = (items: Receivable[]) =>
    items.reduce((acc, r) => {
      if (r.status === "settled") return acc;
      const code = r.currency.code;
      if (!acc[code]) acc[code] = { symbol: r.currency.symbol, remaining: 0 };
      acc[code].remaining += r.remainingAmount;
      return acc;
    }, {} as Record<string, { symbol: string; remaining: number }>);

  const counts = {
    open: receivables.filter(r => r.status === "open").length,
    partial: receivables.filter(r => r.status === "partial").length,
    overdue: receivables.filter(r => isOverdue(r)).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden file input for attach-after-the-fact */}
      <input
        ref={attachInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleAttachFile}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Receivables (AR)</h1>
          <p className="text-slate-500 text-sm mt-1">Money others owe you — tracked per person, per currency</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />New Receivable</Button>
      </div>

      {(counts.open > 0 || counts.partial > 0 || counts.overdue > 0) && (
        <div className="flex gap-2 flex-wrap">
          {counts.open > 0 && <span className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 font-medium">{counts.open} Open</span>}
          {counts.partial > 0 && <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 font-medium">{counts.partial} Partial</span>}
          {counts.overdue > 0 && <span className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 font-medium flex items-center gap-1"><span className="pulse-dot w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />{counts.overdue} Overdue</span>}
        </div>
      )}

      <div className="flex gap-2">
        {["all", "open", "partial", "settled"].map(s => (
          <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No receivables found.</p>
          <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add your first receivable</Button>
        </div>
      ) : Object.values(grouped).map(({ contact, items }) => {
        const totals = contactTotals(items);
        return (
          <Card key={contact.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{contact.name}</span>
                <div className="flex gap-2 flex-wrap justify-end">
                  {Object.entries(totals).map(([code, d]) => (
                    <span key={code} className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      {code} {formatAmount(d.remaining, d.symbol)}
                    </span>
                  ))}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Description</th>
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Currency</th>
                    <th className="text-right py-2 pr-3 font-medium text-slate-500">Original</th>
                    <th className="text-right py-2 pr-3 font-medium text-slate-500">Received</th>
                    <th className="text-right py-2 pr-3 font-medium text-slate-500">Remaining</th>
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Progress</th>
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Status</th>
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Due / Aging</th>
                    <th className="py-2"></th>
                  </tr></thead>
                  <tbody>
                    {items.map(r => {
                      const pct = Math.min(100, r.originalAmount > 0 ? (r.paidAmount / r.originalAmount) * 100 : 0);
                      const overdue = isOverdue(r);
                      const isExpanded = expanded.has(r.id);
                      return (
                        <React.Fragment key={r.id}>
                          <tr className="border-b border-slate-50 hover:bg-slate-50 group">
                            <td className="py-2 pr-3 text-slate-600 max-w-[140px]">
                              <span className="flex items-center gap-1 truncate">
                                <span className="truncate">{r.description || <span className="text-slate-300">—</span>}</span>
                                {r.attachmentUrl && (
                                  <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer" title="View document"
                                    className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors">
                                    <Paperclip className="h-3 w-3" />
                                  </a>
                                )}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-medium">{r.currency.code}</td>
                            <td className="py-2 pr-3 text-right text-slate-600">{formatAmount(r.originalAmount, r.currency.symbol)}</td>
                            <td className="py-2 pr-3 text-right text-green-600">{formatAmount(r.paidAmount, r.currency.symbol)}</td>
                            <td className="py-2 pr-3 text-right font-semibold">{formatAmount(r.remainingAmount, r.currency.symbol)}</td>
                            <td className="py-2 pr-3 min-w-[80px]">
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-20">
                                <div className="h-full bg-green-500 rounded-full progress-bar"
                                  style={{ "--progress-width": `${pct}%`, width: `${pct}%` } as React.CSSProperties} />
                              </div>
                              <span className="text-xs text-slate-400 mt-0.5 block">{Math.round(pct)}%</span>
                            </td>
                            <td className="py-2 pr-3"><Badge variant={statusVariant[r.status]}>{r.status}</Badge></td>
                            <td className={`py-2 pr-3 text-xs ${overdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
                              {overdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
                              {r.dueDate ? getAgingLabel(r.dueDate) : formatDate(r.agreementDate)}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-1">
                                {r.status !== "settled" && (<>
                                  <Button size="sm" variant="success" onClick={() => {
                                    setPayOpen(r.id);
                                    setPayForm({ amount: String(r.remainingAmount), date: new Date().toISOString().slice(0, 10), note: "" });
                                    setPayFile(null);
                                  }}>+ Pay</Button>
                                  <button title="Mark as settled" onClick={() => handleMarkSettled(r)}
                                    className="p-1 rounded hover:bg-green-50 text-slate-300 hover:text-green-600 transition-colors">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </button>
                                </>)}
                                {r.payments.length > 0 && (
                                  <button onClick={() => toggleExpanded(r.id)} className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors">
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </button>
                                )}
                                <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirm(r.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && r.payments.length > 0 && (
                            <tr key={`${r.id}-payments`}>
                              <td colSpan={9} className="pb-3 pt-1 pl-4">
                                <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                                  <p className="text-xs font-medium text-slate-400 mb-2">Payment History — {r.currency.code}</p>
                                  {r.payments.map(p => (
                                    <div key={p.id} className="flex justify-between items-center text-xs text-slate-600 group/pay py-0.5">
                                      <span>{formatDate(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-green-600 font-medium">{formatAmount(p.amount, r.currency.symbol)}</span>
                                        {p.attachmentUrl ? (
                                          <a
                                            href={p.attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="View payment slip"
                                            className="p-0.5 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors"
                                          >
                                            <Paperclip className="h-3 w-3" />
                                          </a>
                                        ) : (
                                          <button
                                            title="Attach payment slip"
                                            disabled={uploading}
                                            onClick={() => triggerAttach(r.id, p.id)}
                                            className="opacity-0 group-hover/pay:opacity-100 p-0.5 rounded hover:bg-slate-200 text-slate-300 hover:text-slate-500 transition-all"
                                          >
                                            <Upload className="h-3 w-3" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeletePayment(r.id, p.id)}
                                          className="opacity-0 group-hover/pay:opacity-100 p-0.5 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-all"
                                          title="Remove payment"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditRecord(null); setForm(emptyForm()); setRecordFile(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editRecord ? "Edit Receivable" : "New Receivable"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact (who owes you)</Label>
                <Select value={form.contactId} onValueChange={v => setForm(f => ({ ...f, contactId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                {editRecord ? (
                  <Input value={editRecord.currency.code} disabled className="bg-slate-50 text-slate-500" />
                ) : (
                  <Select value={form.currencyId} onValueChange={v => setForm(f => ({ ...f, currencyId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="any" min="0.01" placeholder="0" value={form.originalAmount}
                onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input placeholder="What is this for?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Agreement Date</Label>
                <Input type="date" value={form.agreementDate} onChange={e => setForm(f => ({ ...f, agreementDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date (optional)</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea placeholder="Additional notes..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Agreement / Document (optional)</Label>
              {editRecord?.attachmentUrl && !recordFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <a href={editRecord.attachmentUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-500 hover:text-blue-700">
                    <Paperclip className="h-4 w-4" />View current document
                  </a>
                  <span className="text-slate-300">|</span>
                  <label className="text-slate-500 hover:text-slate-700 cursor-pointer underline text-xs">
                    Replace
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                      onChange={e => setRecordFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500 truncate">
                    {recordFile ? recordFile.name : "Attach JPG, PNG, or PDF (max 5MB)"}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                    onChange={e => setRecordFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {recordFile && (
                <button type="button" onClick={() => setRecordFile(null)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <X className="h-3 w-3" /> Remove file
                </button>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || uploading || !form.contactId || (!editRecord && !form.currencyId) || !form.originalAmount}>
                {uploading ? "Uploading..." : loading ? "Saving..." : editRecord ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Receivable?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This will permanently delete this receivable and all its payment history.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Payment Dialog */}
      <Dialog open={!!payOpen} onOpenChange={() => { setPayOpen(null); setPayFile(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Payment Received</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {payOpen && (() => {
              const r = receivables.find(x => x.id === payOpen);
              if (!r) return null;
              return (
                <>
                  <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">Contact</span><span className="font-medium">{r.contact.name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Currency</span><span className="font-medium">{r.currency.code}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Remaining</span><span className="font-semibold text-green-600">{formatAmount(r.remainingAmount, r.currency.symbol)}</span></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount Received ({r.currency.code})</Label>
                    <Input type="number" step="any" min="0.01" max={r.remainingAmount} placeholder="0"
                      value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Input placeholder="e.g. March payment" value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Slip (optional)</Label>
                    <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors">
                      <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-500 truncate">
                        {payFile ? payFile.name : "Attach JPG, PNG, or PDF (max 5MB)"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={e => setPayFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {payFile && (
                      <button onClick={() => setPayFile(null)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                        <X className="h-3 w-3" /> Remove file
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayOpen(null); setPayFile(null); }}>Cancel</Button>
            <Button variant="success" disabled={loading || uploading || !payForm.amount} onClick={() => payOpen && handlePayment(payOpen)}>
              {uploading ? "Uploading..." : loading ? "Saving..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
