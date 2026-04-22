"use client";
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AmountInput } from "@/components/ui/amount-input";
import { Textarea } from "@/components/ui/textarea";
import { formatAmount, formatDate, getAgingLabel } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, AlertCircle, CheckCircle2, X, Paperclip, Upload } from "lucide-react";

interface Currency { id: string; code: string; symbol: string }
interface Contact { id: string; name: string }
interface Payment { id: string; amount: number; date: string; note: string | null; currency: Currency; attachmentUrl: string | null }
interface Payable {
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

export default function PayablesPage() {
  const { toast } = useToast();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [open, setOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Payable | null>(null);
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
  const [attachingPayment, setAttachingPayment] = useState<{ payableId: string; paymentId: string } | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAll();
    fetch("/api/contacts").then(r => r.json()).then(setContacts);
    fetch("/api/currencies").then(r => r.json()).then(setCurrencies);
  }, []);

  function fetchAll() {
    fetch("/api/payables").then(r => r.json()).then(setPayables);
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openAdd() { setEditRecord(null); setForm(emptyForm()); setRecordFile(null); setOpen(true); }
  function openEdit(p: Payable) {
    setEditRecord(p);
    setForm({
      contactId: p.contact.id, currencyId: p.currency.id,
      originalAmount: String(p.originalAmount), description: p.description ?? "",
      agreementDate: p.agreementDate.slice(0, 10), dueDate: p.dueDate?.slice(0, 10) ?? "", note: p.note ?? "",
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
    const url = editRecord ? `/api/payables/${editRecord.id}` : "/api/payables";
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
      toast(editRecord ? "Payable updated" : "Payable created");
      setOpen(false); setEditRecord(null); setForm(emptyForm()); setRecordFile(null); fetchAll();
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to save", "error");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/payables/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    if (res.ok) { toast("Payable deleted"); fetchAll(); }
    else { const d = await res.json(); toast(d.error ?? "Failed to delete", "error"); }
  }

  async function handleMarkSettled(p: Payable) {
    if (p.remainingAmount <= 0) return;
    setLoading(true);
    const res = await fetch(`/api/payables/${p.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: p.remainingAmount, date: new Date().toISOString().slice(0, 10), note: "Marked as settled" }),
    });
    setLoading(false);
    if (res.ok) {
      const updated = await res.json();
      setPayables(prev => prev.map(x => x.id === p.id ? updated : x));
      toast("Marked as settled");
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to mark as settled", "error");
    }
  }

  async function handlePayment(payableId: string) {
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
    const res = await fetch(`/api/payables/${payableId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(payForm.amount), date: payForm.date, note: payForm.note, attachmentUrl }),
    });
    setLoading(false);
    if (res.ok) {
      const updated = await res.json();
      setPayables(prev => prev.map(p => p.id === payableId ? updated : p));
      toast("Payment logged");
      setPayOpen(null);
      setPayForm({ amount: "", date: new Date().toISOString().slice(0, 10), note: "" });
      setPayFile(null);
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to log payment", "error");
    }
  }

  async function handleDeletePayment(payableId: string, paymentId: string) {
    const res = await fetch(`/api/payables/${payableId}/payments/${paymentId}`, { method: "DELETE" });
    if (res.ok) {
      const updated = await res.json();
      setPayables(prev => prev.map(p => p.id === payableId ? updated : p));
      toast("Payment removed");
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to remove payment", "error");
    }
  }

  function triggerAttach(payableId: string, paymentId: string) {
    setAttachingPayment({ payableId, paymentId });
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
    const { payableId, paymentId } = attachingPayment;
    const res = await fetch(`/api/payables/${payableId}/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrl: url }),
    });
    setAttachingPayment(null);
    if (res.ok) {
      setPayables(prev => prev.map(p => p.id === payableId ? {
        ...p,
        payments: p.payments.map(pay => pay.id === paymentId ? { ...pay, attachmentUrl: url } : pay),
      } : p));
      toast("Slip attached");
    } else {
      toast("Failed to attach slip", "error");
    }
  }

  const filtered = filterStatus === "all" ? payables : payables.filter(p => p.status === filterStatus);

  const grouped = filtered.reduce((acc, p) => {
    const key = p.contact.id;
    if (!acc[key]) acc[key] = { contact: p.contact, items: [] };
    acc[key].items.push(p);
    return acc;
  }, {} as Record<string, { contact: Contact; items: Payable[] }>);

  const now = new Date();
  const isOverdue = (p: Payable) => p.dueDate && new Date(p.dueDate) < now && p.status !== "settled";

  const contactTotals = (items: Payable[]) =>
    items.reduce((acc, p) => {
      if (p.status === "settled") return acc;
      const code = p.currency.code;
      if (!acc[code]) acc[code] = { symbol: p.currency.symbol, remaining: 0 };
      acc[code].remaining += p.remainingAmount;
      return acc;
    }, {} as Record<string, { symbol: string; remaining: number }>);

  const counts = {
    open: payables.filter(p => p.status === "open").length,
    partial: payables.filter(p => p.status === "partial").length,
    overdue: payables.filter(p => isOverdue(p)).length,
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
          <h1 className="text-2xl font-bold text-slate-900">Payables (AP)</h1>
          <p className="text-slate-500 text-sm mt-1">Money you owe others — tracked per person, per currency</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />New Payable</Button>
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
          <p className="text-slate-400 text-sm">No payables found.</p>
          <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add your first payable</Button>
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
                    <span key={code} className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
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
                    <th className="text-right py-2 pr-3 font-medium text-slate-500">Paid</th>
                    <th className="text-right py-2 pr-3 font-medium text-slate-500">Remaining</th>
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Progress</th>
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Status</th>
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Due / Aging</th>
                    <th className="py-2"></th>
                  </tr></thead>
                  <tbody>
                    {items.map(p => {
                      const pct = Math.min(100, p.originalAmount > 0 ? (p.paidAmount / p.originalAmount) * 100 : 0);
                      const overdue = isOverdue(p);
                      const isExpanded = expanded.has(p.id);
                      return (
                        <React.Fragment key={p.id}>
                          <tr className="border-b border-slate-50 hover:bg-slate-50 group">
                            <td className="py-2 pr-3 text-slate-600 max-w-[140px]">
                              <span className="flex items-center gap-1 truncate">
                                <span className="truncate">{p.description || <span className="text-slate-300">—</span>}</span>
                                {p.attachmentUrl && (
                                  <a href={p.attachmentUrl} target="_blank" rel="noopener noreferrer" title="View document"
                                    className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors">
                                    <Paperclip className="h-3 w-3" />
                                  </a>
                                )}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-medium">{p.currency.code}</td>
                            <td className="py-2 pr-3 text-right text-slate-600">{formatAmount(p.originalAmount, p.currency.symbol)}</td>
                            <td className="py-2 pr-3 text-right text-blue-600">{formatAmount(p.paidAmount, p.currency.symbol)}</td>
                            <td className="py-2 pr-3 text-right font-semibold text-red-600">{formatAmount(p.remainingAmount, p.currency.symbol)}</td>
                            <td className="py-2 pr-3 min-w-[80px]">
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-20">
                                <div
                                  className="h-full bg-blue-500 rounded-full progress-bar"
                                  style={{ "--progress-width": `${pct}%`, width: `${pct}%` } as React.CSSProperties}
                                />
                              </div>
                              <span className="text-xs text-slate-400 mt-0.5 block">{Math.round(pct)}%</span>
                            </td>
                            <td className="py-2 pr-3"><Badge variant={statusVariant[p.status]}>{p.status}</Badge></td>
                            <td className={`py-2 pr-3 text-xs ${overdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
                              {overdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
                              {p.dueDate ? getAgingLabel(p.dueDate) : formatDate(p.agreementDate)}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-1">
                                {p.status !== "settled" && (
                                  <>
                                    <Button size="sm" onClick={() => {
                                      setPayOpen(p.id);
                                      setPayForm({ amount: String(p.remainingAmount), date: new Date().toISOString().slice(0, 10), note: "" });
                                      setPayFile(null);
                                    }}>+ Pay</Button>
                                    <button
                                      title="Mark as settled"
                                      disabled={loading}
                                      onClick={() => handleMarkSettled(p)}
                                      className="p-1 rounded hover:bg-green-50 text-slate-300 hover:text-green-600 transition-colors"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                {p.payments.length > 0 && (
                                  <button onClick={() => toggleExpanded(p.id)} className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors">
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </button>
                                )}
                                <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirm(p.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && p.payments.length > 0 && (
                            <tr key={`${p.id}-payments`}>
                              <td colSpan={9} className="pb-3 pt-1 pl-4">
                                <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                                  <p className="text-xs font-medium text-slate-400 mb-2">Payment History — {p.currency.code}</p>
                                  {p.payments.map(pay => (
                                    <div key={pay.id} className="flex justify-between items-center text-xs text-slate-600 group/pay py-0.5">
                                      <span>{formatDate(pay.date)}{pay.note ? ` · ${pay.note}` : ""}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-blue-600 font-medium">{formatAmount(pay.amount, p.currency.symbol)}</span>
                                        {pay.attachmentUrl ? (
                                          <a
                                            href={pay.attachmentUrl}
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
                                            onClick={() => triggerAttach(p.id, pay.id)}
                                            className="opacity-0 group-hover/pay:opacity-100 p-0.5 rounded hover:bg-slate-200 text-slate-300 hover:text-slate-500 transition-all"
                                          >
                                            <Upload className="h-3 w-3" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeletePayment(p.id, pay.id)}
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
          <DialogHeader><DialogTitle>{editRecord ? "Edit Payable" : "New Payable"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact (who you owe)</Label>
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
              <AmountInput placeholder="0" value={form.originalAmount}
                onChange={v => setForm(f => ({ ...f, originalAmount: v }))} required />
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

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Payable?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This will permanently delete this payable and all its payment history. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Payment Dialog */}
      <Dialog open={!!payOpen} onOpenChange={() => { setPayOpen(null); setPayFile(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Payment Made</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {payOpen && (() => {
              const p = payables.find(x => x.id === payOpen);
              if (!p) return null;
              return (
                <>
                  <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">Contact</span><span className="font-medium">{p.contact.name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Currency</span><span className="font-medium">{p.currency.code}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Remaining</span><span className="font-semibold text-red-600">{formatAmount(p.remainingAmount, p.currency.symbol)}</span></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount Paid ({p.currency.code})</Label>
                    <AmountInput placeholder="0" value={payForm.amount}
                      onChange={v => setPayForm(f => ({ ...f, amount: v }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Input placeholder="e.g. March repayment" value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} />
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
            <Button disabled={loading || uploading || !payForm.amount} onClick={() => payOpen && handlePayment(payOpen)}>
              {uploading ? "Uploading..." : loading ? "Saving..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
