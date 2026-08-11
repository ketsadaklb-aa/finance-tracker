"use client";
import { use } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const NoteShareView = dynamic(() => import("./note-share-view"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
    </div>
  ),
});

export default function SharedNotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <NoteShareView token={token} />;
}
