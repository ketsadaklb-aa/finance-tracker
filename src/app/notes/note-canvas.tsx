"use client";
import { Excalidraw, exportToCanvas } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, Loader2, Share2, Download, Copy, X, ShieldOff, Link2 } from "lucide-react";
import { notoLao } from "./lao-font";

type Scene = { elements?: unknown[]; appState?: { viewBackgroundColor?: string }; files?: unknown };
type ExApi = { getSceneElements: () => readonly unknown[]; getAppState: () => Record<string, unknown>; getFiles: () => unknown };

export default function NoteCanvas({ noteId }: { noteId: string }) {
  const [title, setTitle] = useState("Untitled");
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const [exporting, setExporting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipEarly = useRef(true);
  const apiRef = useRef<ExApi | null>(null);

  // Share dialog
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<{ enabled: boolean; token: string | null } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl = shareStatus?.token ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/note/${shareStatus.token}` : "";

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
    const t = setTimeout(() => { skipEarly.current = false; }, 800);
    return () => clearTimeout(t);
  }, [noteId]);

  const persist = useCallback((body: Record<string, unknown>) => {
    setStatus("saving");
    fetch(`/api/notes/${noteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(() => setStatus("saved")).catch(() => setStatus("saved"));
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

  async function exportPdf() {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    if (!elements.length) { alert("Nothing to export yet — add something to the note first."); return; }
    setExporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await exportToCanvas({ elements: elements as any, appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false } as any, files: api.getFiles() as any });
      const dataUrl = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      const landscape = canvas.width >= canvas.height;
      const pdf = new jsPDF({ orientation: landscape ? "l" : "p", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(dataUrl, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${(title || "note").replace(/[^\w-]+/g, "_")}.pdf`);
    } catch { alert("Export failed — please try again."); }
    finally { setExporting(false); }
  }

  async function openShare() {
    setShareOpen(true); setShareStatus(null); setCopied(false);
    const r = await fetch(`/api/notes/${noteId}/share`);
    setShareStatus(r.ok ? await r.json() : { enabled: false, token: null });
  }
  async function enableShare() {
    setShareBusy(true);
    const r = await fetch(`/api/notes/${noteId}/share`, { method: "POST" });
    setShareBusy(false);
    if (r.ok) setShareStatus(await r.json());
  }
  async function revokeShare() {
    setShareBusy(true);
    const r = await fetch(`/api/notes/${noteId}/share`, { method: "DELETE" });
    setShareBusy(false);
    if (r.ok) setShareStatus({ enabled: false, token: null });
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }

  if (!initial) return <div className="fixed inset-0 flex items-center justify-center bg-white z-50"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;

  return (
    <div className={`${notoLao.className} fixed inset-0 md:left-60 z-50 flex flex-col bg-white`}>
      <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-200 shrink-0">
        <Link href="/notes" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft className="h-5 w-5" /></Link>
        <input value={title} onChange={e => onTitle(e.target.value)}
          className="font-semibold text-slate-800 text-lg outline-none flex-1 min-w-0 bg-transparent" placeholder="Untitled" />
        <span className="text-xs text-slate-400 hidden sm:flex items-center gap-1 shrink-0 mr-1">
          {status === "saving" ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : <><Check className="h-3 w-3 text-emerald-500" /> Saved</>}
        </span>
        <button onClick={exportPdf} disabled={exporting} title="Export PDF"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden sm:inline">PDF</span>
        </button>
        <button onClick={openShare} title="Share note"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-emerald-600 hover:bg-emerald-50 border border-emerald-200">
          <Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span>
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Excalidraw initialData={initial} onChange={onChange} excalidrawAPI={(api) => { apiRef.current = api as unknown as ExApi; }} />
      </div>

      {shareOpen && (
        <div className="absolute inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setShareOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Share2 className="h-4 w-4 text-emerald-600" /> Share note</h3>
              <button onClick={() => setShareOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            {!shareStatus ? (
              <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            ) : shareStatus.enabled ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Anyone with this link can view this note (read-only). Revoke anytime.</p>
                <div className="flex gap-2">
                  <input readOnly value={shareUrl} onFocus={e => e.target.select()}
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" />
                  <button onClick={copyLink} className="px-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <button onClick={revokeShare} disabled={shareBusy}
                    className="flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                    <ShieldOff className="h-4 w-4" /> Revoke link
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Create a private link so others can view this note online (read-only).</p>
                <button onClick={enableShare} disabled={shareBusy}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-medium py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                  {shareBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Create share link
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
