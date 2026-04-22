"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatAmount } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Plus, User, Pencil, Trash2 } from "lucide-react";

interface Contact {
  id: string; name: string; phone: string | null; note: string | null;
  _count: { receivables: number; payables: number };
}
interface ARAPItem { contactId: string; currencyCode: string; currencySymbol: string; remaining: number }

export default function ContactsPage() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [arItems, setArItems] = useState<ARAPItem[]>([]);
  const [apItems, setApItems] = useState<ARAPItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", note: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  function fetchAll() {
    fetch("/api/contacts").then(r => r.json()).then(setContacts);
    fetch("/api/receivables").then(r => r.json()).then((data: { contactId: string; status: string; remainingAmount: number; currency: { code: string; symbol: string } }[]) => {
      const items: ARAPItem[] = [];
      for (const r of data) {
        if (r.status === "settled") continue;
        items.push({ contactId: r.contactId, currencyCode: r.currency.code, currencySymbol: r.currency.symbol, remaining: r.remainingAmount });
      }
      setArItems(items);
    });
    fetch("/api/payables").then(r => r.json()).then((data: { contactId: string; status: string; remainingAmount: number; currency: { code: string; symbol: string } }[]) => {
      const items: ARAPItem[] = [];
      for (const p of data) {
        if (p.status === "settled") continue;
        items.push({ contactId: p.contactId, currencyCode: p.currency.code, currencySymbol: p.currency.symbol, remaining: p.remainingAmount });
      }
      setApItems(items);
    });
  }

  function getContactAR(contactId: string) {
    return arItems.filter(i => i.contactId === contactId).reduce((acc, i) => {
      if (!acc[i.currencyCode]) acc[i.currencyCode] = { symbol: i.currencySymbol, total: 0 };
      acc[i.currencyCode].total += i.remaining;
      return acc;
    }, {} as Record<string, { symbol: string; total: number }>);
  }

  function getContactAP(contactId: string) {
    return apItems.filter(i => i.contactId === contactId).reduce((acc, i) => {
      if (!acc[i.currencyCode]) acc[i.currencyCode] = { symbol: i.currencySymbol, total: 0 };
      acc[i.currencyCode].total += i.remaining;
      return acc;
    }, {} as Record<string, { symbol: string; total: number }>);
  }

  function openAdd() { setEditContact(null); setForm({ name: "", phone: "", note: "" }); setOpen(true); }
  function openEdit(c: Contact) { setEditContact(c); setForm({ name: c.name, phone: c.phone ?? "", note: c.note ?? "" }); setOpen(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const url = editContact ? `/api/contacts/${editContact.id}` : "/api/contacts";
    const method = editContact ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      toast(editContact ? "Contact updated" : "Contact created");
      setOpen(false); setEditContact(null); fetchAll();
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to save", "error");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    if (res.ok) { toast("Contact deleted"); fetchAll(); }
    else { const d = await res.json(); toast(d.error ?? "Cannot delete this contact", "error"); }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-slate-500 text-sm mt-1">People and businesses you transact with</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Contact</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {contacts.length === 0 ? (
          <div className="col-span-3 text-center py-16">
            <p className="text-slate-400 text-sm">No contacts yet.</p>
            <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add your first contact</Button>
          </div>
        ) : contacts.map(c => {
          const ar = getContactAR(c.id);
          const ap = getContactAP(c.id);
          const hasAR = Object.keys(ar).length > 0;
          const hasAP = Object.keys(ap).length > 0;
          return (
            <Card key={c.id} className="animate-fade-in card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />{c.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm(c.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {c.phone && <p className="text-sm text-slate-500">{c.phone}</p>}
                {c.note && <p className="text-sm text-slate-400 italic">{c.note}</p>}

                {/* AR summary */}
                {hasAR && (
                  <div className="pt-1 space-y-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Owes you (AR)</p>
                    {Object.entries(ar).map(([code, d]) => (
                      <div key={code} className="flex justify-between text-xs">
                        <span className="text-slate-500">{code}</span>
                        <span className="font-semibold text-green-600">{formatAmount(d.total, d.symbol)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* AP summary */}
                {hasAP && (
                  <div className="pt-1 space-y-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">You owe (AP)</p>
                    {Object.entries(ap).map(([code, d]) => (
                      <div key={code} className="flex justify-between text-xs">
                        <span className="text-slate-500">{code}</span>
                        <span className="font-semibold text-red-500">{formatAmount(d.total, d.symbol)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!hasAR && !hasAP && (
                  <div className="flex gap-2 pt-1">
                    <Badge variant="secondary">{c._count.receivables} AR</Badge>
                    <Badge variant="secondary">{c._count.payables} AP</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditContact(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editContact ? "Edit Contact" : "New Contact"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Mimee" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input placeholder="+856 20 ..." value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. friend, colleague" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || !form.name}>
                {loading ? "Saving..." : editContact ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Contact?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This will permanently delete this contact. Contacts with active AR/AP records cannot be deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
