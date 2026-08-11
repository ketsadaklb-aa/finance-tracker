"use client";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useEffect, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { notoLao } from "../../../notes/lao-font";
import { injectLaoCanvasFont } from "../../../notes/inject-lao-canvas-font";

type Scene = { elements?: unknown[]; appState?: { viewBackgroundColor?: string }; files?: unknown };

export default function NoteShareView({ token }: { token: string }) {
  const [title, setTitle] = useState("");
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);
  const [dead, setDead] = useState(false);

  useEffect(() => { injectLaoCanvasFont(); }, []);
  useEffect(() => {
    fetch(`/api/share/note/${token}`)
      .then(r => (r.ok ? r.json() : null))
      .then((n: { title: string; data: Scene | null } | null) => {
        if (!n) { setDead(true); return; }
        setTitle(n.title);
        const d = n.data;
        setInitial(d
          ? { elements: d.elements ?? [], appState: { viewBackgroundColor: d.appState?.viewBackgroundColor ?? "#ffffff" }, files: d.files ?? undefined, scrollToContent: true }
          : {});
      })
      .catch(() => setDead(true));
  }, [token]);

  if (dead) {
    return (
      <div className={`${notoLao.className} fixed inset-0 flex flex-col items-center justify-center bg-slate-100 text-center px-4`}>
        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center"><Lock className="h-5 w-5 text-slate-400" /></div>
        <p className="text-slate-600 font-medium mt-4">This note link is no longer active.</p>
        <p className="text-slate-400 text-sm mt-1">Ask the sender for a new link.</p>
      </div>
    );
  }
  if (!initial) return <div className="fixed inset-0 flex items-center justify-center bg-white z-50"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;

  return (
    <div className={`${notoLao.className} fixed inset-0 flex flex-col bg-white`}>
      <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-200 shrink-0 bg-slate-800 text-white">
        <span className="font-semibold text-lg truncate flex-1">{title || "Untitled"}</span>
        <span className="text-xs text-slate-300 flex items-center gap-1 shrink-0"><ShieldCheck className="h-3.5 w-3.5" /> Read-only</span>
      </div>
      <div className="flex-1 min-h-0">
        <Excalidraw initialData={initial} viewModeEnabled />
      </div>
    </div>
  );
}
