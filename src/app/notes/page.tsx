"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Loader2, PenLine, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { notoLao } from "./lao-font";

interface NoteMeta { id: string; title: string; createdAt: string; updatedAt: string }
type SortKey = "updatedAt" | "createdAt";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** "Just now", "5 min ago", "3 h ago", "Yesterday", then a plain date. */
function relative(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24 && d.getDate() === new Date().getDate()) return `${Math.round(mins / 60)} h ago`;
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

/** Group heading for a date: Today / Yesterday / This week / "September 2026". */
function groupLabel(iso: string) {
  const d = new Date(iso);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((start.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default function NotesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");

  // Most recent first, then bucketed under date headings
  const groups = useMemo(() => {
    const sorted = [...notes].sort((a, b) => new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime());
    const out: { label: string; items: NoteMeta[] }[] = [];
    for (const n of sorted) {
      const label = groupLabel(n[sortBy]);
      if (out.at(-1)?.label === label) out.at(-1)!.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [notes, sortBy]);

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
    <div className={`${notoLao.className} max-w-3xl mx-auto`}>
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
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">{notes.length} note{notes.length === 1 ? "" : "s"}</p>
            <div className="flex p-0.5 rounded-lg bg-slate-900/[0.05] text-xs font-medium" role="tablist" aria-label="Sort notes">
              {([["updatedAt", "Last edited"], ["createdAt", "Date created"]] as const).map(([key, label]) => (
                <button key={key} role="tab" aria-selected={sortBy === key} onClick={() => setSortBy(key)}
                  className={`px-2.5 py-1 rounded-md transition-all ${sortBy === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {groups.map(g => (
              <section key={g.label}>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 px-1 mb-2">{g.label}</h2>
                <ul className="rounded-2xl bg-white/85 backdrop-blur ring-1 ring-slate-200/70 shadow-sm shadow-slate-900/[0.03] divide-y divide-slate-100 overflow-hidden">
                  {g.items.map(n => (
                    <li key={n.id}>
                      <Link href={`/notes/${n.id}`}
                        className="group flex items-center gap-3 px-4 py-3 hover:bg-indigo-50/40 transition-colors">
                        <span className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                          <PenLine className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 truncate">{n.title || "Untitled"}</p>
                          <p className="text-xs text-slate-400 mt-0.5" title={fmt(n[sortBy])}>
                            {sortBy === "updatedAt" ? "Edited" : "Created"} {relative(n[sortBy])}
                            <span className="hidden sm:inline">
                              {" · "}{/ago|now/.test(relative(n[sortBy]))
                                ? fmt(n[sortBy])
                                : new Date(n[sortBy]).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </p>
                        </div>
                        <button onClick={e => remove(n.id, e)} title="Delete note" aria-label="Delete note"
                          className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
