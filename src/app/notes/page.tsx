"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface NoteMeta { id: string; title: string; updatedAt: string }

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function NotesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const r = await fetch("/api/notes");
    if (r.ok) setNotes(await r.json());
    setLoading(false);
  }

  async function create() {
    setCreating(true);
    const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setCreating(false);
    if (!r.ok) { toast("Couldn't create note", "error"); return; }
    const n = await r.json();
    router.push(`/notes/${n.id}`);
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this note? This can't be undone.")) return;
    setNotes(prev => prev.filter(n => n.id !== id));
    const r = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!r.ok) { toast("Delete failed", "error"); load(); } else toast("Note deleted");
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notes</h1>
          <p className="text-sm text-slate-400">A whiteboard for sketches, plans, and ideas — draw, add shapes, text, and images.</p>
        </div>
        <Button onClick={create} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />} New note
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
      ) : notes.length === 0 ? (
        <button onClick={create} className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-16 flex flex-col items-center gap-2 text-slate-400 hover:border-slate-300 hover:text-slate-500">
          <PenLine className="h-8 w-8" />
          <span className="text-sm font-medium">Create your first note</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {notes.map(n => (
            <Link key={n.id} href={`/notes/${n.id}`}
              className="group relative rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition">
              <div className="h-24 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-100 mb-3 flex items-center justify-center">
                <PenLine className="h-6 w-6 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-800 truncate">{n.title || "Untitled"}</p>
              <p className="text-xs text-slate-400 mt-0.5">Edited {fmt(n.updatedAt)}</p>
              <button onClick={e => remove(n.id, e)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
