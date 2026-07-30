"use client";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, Loader2 } from "lucide-react";

type Scene = { elements?: unknown[]; appState?: { viewBackgroundColor?: string }; files?: unknown };

export default function NoteCanvas({ noteId }: { noteId: string }) {
  const [title, setTitle] = useState("Untitled");
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipEarly = useRef(true);

  useEffect(() => {
    fetch(`/api/notes/${noteId}`)
      .then(r => (r.ok ? r.json() : null))
      .then((n: { title: string; data: Scene | null } | null) => {
        if (!n) { setInitial({}); return; }
        setTitle(n.title);
        const d = n.data;
        setInitial(d
          ? { elements: d.elements ?? [], appState: { viewBackgroundColor: d.appState?.viewBackgroundColor ?? "#ffffff" }, files: d.files ?? undefined, scrollToContent: true }
          : {});
      })
      .catch(() => setInitial({}));
    const t = setTimeout(() => { skipEarly.current = false; }, 800); // ignore load-settle onChange
    return () => clearTimeout(t);
  }, [noteId]);

  const persist = useCallback((body: Record<string, unknown>) => {
    setStatus("saving");
    fetch(`/api/notes/${noteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(() => setStatus("saved"))
      .catch(() => setStatus("saved"));
  }, [noteId]);

  const onChange = useCallback((elements: readonly unknown[], appState: { viewBackgroundColor?: string }, files: unknown) => {
    if (skipEarly.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus("saving");
    saveTimer.current = setTimeout(() => {
      persist({ data: { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files } });
    }, 900);
  }, [persist]);

  function onTitle(v: string) {
    setTitle(v);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => persist({ title: v.trim() || "Untitled" }), 700);
  }

  if (!initial) {
    return <div className="fixed inset-0 flex items-center justify-center bg-white z-50"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;
  }

  return (
    <div className="fixed inset-0 md:left-60 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-200 shrink-0">
        <Link href="/notes" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft className="h-5 w-5" /></Link>
        <input value={title} onChange={e => onTitle(e.target.value)}
          className="font-semibold text-slate-800 text-lg outline-none flex-1 min-w-0 bg-transparent" placeholder="Untitled" />
        <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
          {status === "saving" ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : <><Check className="h-3 w-3 text-emerald-500" /> Saved</>}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <Excalidraw initialData={initial} onChange={onChange} />
      </div>
    </div>
  );
}
