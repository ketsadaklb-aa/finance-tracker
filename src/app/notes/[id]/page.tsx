"use client";
import { use } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Excalidraw touches `window`, so load the whole canvas client-side only.
const NoteCanvas = dynamic(() => import("../note-canvas"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
    </div>
  ),
});

export default function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <NoteCanvas noteId={id} />;
}
