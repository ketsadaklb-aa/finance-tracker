"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AmountInput } from "@/components/ui/amount-input";
import { Textarea } from "@/components/ui/textarea";
import { formatAmount, formatDate, getAgingLabel } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2, AlertCircle,
  CheckCircle2, X, Paperclip, Upload, TrendingUp, TrendingDown, Users, FileDown, Loader2,
} from "lucide-react";

interface Currency { id: string; code: string; symbol: string }
interface Contact { id: string; name: string }
interface Payment { id: string; amount: number; date: string; note: string | null; currency: Currency; attachmentUrl: string | null }
interface ARItem {
  id: string; originalAmount: number; paidAmount: number; remainingAmount: number;
  status: string; description: string | null; agreementDate: string; dueDate: string | null;
  note: string | null; attachmentUrl: string | null; contact: Contact; currency: Currency; payments: Payment[];
}
type APItem = ARItem;

const statusVariant: Record<string, "destructive" | "warning" | "success"> = {
  open: "destructive", partial: "warning", settled: "success",
};
const emptyForm = (contactId = "") => ({
  contactId, currencyId: "", originalAmount: "", description: "",
  agreementDate: new Date().toISOString().slice(0, 10), dueDate: "", note: "",
});

// Compress image to max 1200px wide / 1600px tall, JPEG 75% quality.
// PDFs pass through unchanged.
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1200, MAX_H = 1600;
        let { width, height } = img;
        if (width > MAX_W) { height = Math.round(height * MAX_W / width); width = MAX_W; }
        if (height > MAX_H) { width = Math.round(width * MAX_H / height); height = MAX_H; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob
            ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
            : file),
          "image/jpeg", 0.75
        );
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file: File): Promise<string | null> {
  const compressed = await compressImage(file);
  const fd = new FormData();
  fd.append("file", compressed);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  return (await res.json()).url as string;
}

function toBlobUrl(rawUrl: string): { blobUrl: string; isImage: boolean } | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("data:")) {
    const [header, b64] = rawUrl.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    return { blobUrl: URL.createObjectURL(blob), isImage: mime.startsWith("image/") };
  }
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(rawUrl);
  return { blobUrl: rawUrl, isImage };
}

async function downloadContactPDF(contact: Contact, ar: ARItem[], ap: APItem[], lang: "en" | "lo" = "en") {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });

  // Embed Noto Sans Lao (supports Lao + Latin)
  try {
    const fontRes = await fetch("/fonts/NotoSansLao.ttf");
    const fontBuf = await fontRes.arrayBuffer();
    const bytes = new Uint8Array(fontBuf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.slice(i, i + 8192));
    const b64 = btoa(binary);
    doc.addFileToVFS("NotoSansLao.ttf", b64);
    doc.addFont("NotoSansLao.ttf", "NotoSansLao", "normal");
    doc.addFont("NotoSansLao.ttf", "NotoSansLao", "bold");
  } catch { /* falls back to helvetica */ }

  const T = lang === "lo" ? {
    statement:  "ລາຍງານ AR / AP",
    ar_title:   (n: string) => `ລູກໜີ້ (AR)  —  ${n} ເປັນໜີ້ທ່ານ`,
    ap_title:   (n: string) => `ເຈ້ຍໜີ້ (AP)  —  ທ່ານເປັນໜີ້ ${n}`,
    no_records: "ບໍ່ມີລາຍການ.",
    col_desc:   "ລາຍລະອຽດ",
    col_agreed: "ວັນທີ",
    col_status: "ສະຖານະ",
    col_orig:   "ຈຳນວນ",
    col_paid:   "ຈ່າຍ",
    col_recv:   "ຮັບ",
    col_rem:    "ຄ້າງ",
    s_open:     "ຄ້າງ",
    s_partial:  "ບາງສ່ວນ",
    s_settled:  "ສຳເລັດ",
    due:        "ກຳນົດ:",
    overdue:    "ເກີນ",
    payment:    "ຊຳລະ",
    total:      "ລວມ",
    no_desc:    "(ບໍ່ມີລາຍລະອຽດ)",
    footer:     "Catdy's AR AP Tracker  |  ລັບສະເພາະ",
  } : {
    statement:  "AR / AP Statement",
    ar_title:   (n: string) => `Receivables (AR)  —  ${n} owes you`,
    ap_title:   (n: string) => `Payables (AP)  —  You owe ${n}`,
    no_records: "No records.",
    col_desc:   "Description",
    col_agreed: "Agreed",
    col_status: "Status",
    col_orig:   "Original",
    col_paid:   "Paid",
    col_recv:   "Received",
    col_rem:    "Remaining",
    s_open:     "OPEN",
    s_partial:  "PARTIAL",
    s_settled:  "SETTLED",
    due:        "Due:",
    overdue:    "OVERDUE",
    payment:    "Payment",
    total:      "TOTAL",
    no_desc:    "(No description)",
    footer:     "Catdy's AR AP Tracker  |  Confidential",
  };

  const PAGE_W = 148, ML = 8, MR = 8, CW = PAGE_W - ML - MR;
  const FOOTER_Y = 204, MAX_Y = FOOTER_Y - 6;
  const F = "NotoSansLao";

  // Column layout (132mm total): Desc 42 | Agreed 22 | Status 18 | Orig 16 | Paid 16 | Rem 18
  const C_DESC    = ML + 1;         // left-align
  const C_DATE    = ML + 43;        // left-align
  const C_STATUS  = ML + 65;        // left-align
  const C_ORIG_R  = ML + 98 - 1;    // right-align (col ends at ML+98)
  const C_PAID_R  = ML + 114 - 1;   // right-align (col ends at ML+114)
  const C_REM_R   = ML + CW - 1;    // right-align

  const num = (v: number) => Math.round(v).toLocaleString("en-US");
  const fd  = (d: string | Date) =>
    (typeof d === "string" ? new Date(d) : d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  const now = new Date();

  let y = 0;
  const checkY = (h: number) => { if (y + h > MAX_Y) { doc.addPage(); y = 14; } };

  // ── Page 1 header ──
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, PAGE_W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont(F, "bold");
  doc.text(contact.name, ML, 13);
  doc.setFontSize(8);
  doc.setFont(F, "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(T.statement + "  |  " + fd(now), ML, 21);
  doc.setTextColor(30, 41, 59);
  y = 32;

  // ── Column header row (reused after page breaks) ──
  const drawColHeaders = (isAR: boolean) => {
    const H = 7;
    doc.setFillColor(241, 245, 249);
    doc.rect(ML, y, CW, H, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(ML, y + H, ML + CW, y + H);
    doc.setLineWidth(0.15);
    for (const sx of [ML + 42, ML + 64, ML + 82, ML + 98, ML + 114])
      doc.line(sx, y + 1, sx, y + H - 1);
    doc.setFontSize(6.5);
    doc.setFont(F, "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(T.col_desc,   C_DESC,   y + 4.8);
    doc.text(T.col_agreed, C_DATE,   y + 4.8);
    doc.text(T.col_status, C_STATUS, y + 4.8);
    doc.text(T.col_orig,   C_ORIG_R, y + 4.8, { align: "right" });
    doc.text(isAR ? T.col_recv : T.col_paid, C_PAID_R, y + 4.8, { align: "right" });
    doc.text(T.col_rem,    C_REM_R,  y + 4.8, { align: "right" });
    y += H;
  };

  const drawSection = (items: ARItem[], type: "ar" | "ap") => {
    const isAR = type === "ar";

    // Section title + rule
    checkY(18);
    doc.setFontSize(9);
    doc.setFont(F, "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(isAR ? T.ar_title(contact.name) : T.ap_title(contact.name), ML, y + 5.5);
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.4);
    doc.line(ML, y + 7.5, ML + CW, y + 7.5);
    y += 11;

    if (items.length === 0) {
      checkY(9);
      doc.setFontSize(7.5);
      doc.setFont(F, "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(T.no_records, C_DESC, y + 5);
      y += 9;
      return;
    }

    drawColHeaders(isAR);

    const totals: Record<string, { orig: number; paid: number; rem: number }> = {};

    for (const item of items) {
      const overdue  = !!(item.dueDate && new Date(item.dueDate) < now && item.status !== "settled");
      const ccy      = item.currency.code;
      const desc     = item.description || T.no_desc;
      const descLines = (doc.splitTextToSize(desc, 40) as string[]).slice(0, 2);
      const hasDue   = !!item.dueDate;
      const lineCount = Math.max(descLines.length, hasDue ? 2 : 1);
      const rowH     = 3 + lineCount * 4.5 + 2;
      const totalH   = rowH + item.payments.length * 5;

      const prevY = y;
      checkY(totalH + 1);
      if (y !== prevY) drawColHeaders(isAR); // page break — reprint headers

      const rowY = y;

      // Description (bold, wraps up to 2 lines)
      doc.setFontSize(8);
      doc.setFont(F, "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(descLines, C_DESC, rowY + 4.5);

      // Agreed date
      doc.setFont(F, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(fd(item.agreementDate), C_DATE, rowY + 4.5);

      // Due date (2nd line, smaller)
      if (item.dueDate) {
        doc.setFontSize(6.5);
        doc.setTextColor(overdue ? 220 : 148, overdue ? 38 : 163, overdue ? 38 : 184);
        doc.text(T.due + " " + fd(item.dueDate) + (overdue ? " !" : ""), C_DATE, rowY + 9);
      }

      // Status
      doc.setFontSize(7.5);
      doc.setFont(F, "bold");
      const statusLabel = overdue && item.status !== "settled" ? T.overdue
                        : item.status === "settled" ? T.s_settled
                        : item.status === "partial"  ? T.s_partial : T.s_open;
      if (item.status === "settled")      doc.setTextColor(21, 128, 61);
      else if (item.status === "partial") doc.setTextColor(154, 52, 18);
      else if (overdue)                   doc.setTextColor(220, 38, 38);
      else                                doc.setTextColor(100, 116, 139);
      doc.text(statusLabel, C_STATUS, rowY + 4.5);

      // Original (grey)
      doc.setFont(F, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(num(item.originalAmount), C_ORIG_R, rowY + 4.5, { align: "right" });

      // Paid (grey)
      doc.text(num(item.paidAmount), C_PAID_R, rowY + 4.5, { align: "right" });

      // Remaining (bold, coloured)
      doc.setFont(F, "bold");
      doc.setFontSize(8.5);
      if (item.status === "settled")  doc.setTextColor(21, 128, 61);
      else if (overdue)               doc.setTextColor(220, 38, 38);
      else if (!isAR)                 doc.setTextColor(185, 28, 28);
      else                            doc.setTextColor(37, 99, 235);
      doc.text(num(item.remainingAmount) + " " + ccy, C_REM_R, rowY + 4.5, { align: "right" });

      y += rowH;

      // Payment sub-rows
      for (const p of item.payments) {
        const pY = y;
        doc.setFontSize(6.5);
        doc.setFont(F, "normal");
        doc.setTextColor(148, 163, 184);
        const noteStr = p.note ? "  " + p.note.substring(0, 22) : "";
        doc.text("  └ " + T.payment + "  " + fd(p.date) + noteStr, C_DESC, pY + 3.5);
        doc.setFont(F, "bold");
        doc.setFontSize(7);
        if (isAR) doc.setTextColor(21, 128, 61); else doc.setTextColor(37, 99, 235);
        doc.text(num(p.amount) + " " + p.currency.code, C_PAID_R, pY + 3.5, { align: "right" });
        y += 5;
      }

      // Row divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(ML, y, ML + CW, y);

      if (!totals[ccy]) totals[ccy] = { orig: 0, paid: 0, rem: 0 };
      totals[ccy].orig += item.originalAmount;
      totals[ccy].paid += item.paidAmount;
      totals[ccy].rem  += item.remainingAmount;
    }

    // Totals row(s) per currency
    y += 2;
    for (const [code, t] of Object.entries(totals)) {
      checkY(8);
      doc.setFillColor(241, 245, 249);
      doc.rect(ML, y, CW, 7, "F");
      doc.setFontSize(7.5);
      doc.setFont(F, "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(T.total + " (" + code + ")", C_DESC, y + 5);
      doc.setFont(F, "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(num(t.orig), C_ORIG_R, y + 5, { align: "right" });
      doc.text(num(t.paid), C_PAID_R, y + 5, { align: "right" });
      doc.setFont(F, "bold");
      if (isAR) doc.setTextColor(37, 99, 235); else doc.setTextColor(185, 28, 28);
      doc.text(num(t.rem) + " " + code, C_REM_R, y + 5, { align: "right" });
      y += 8;
    }
    y += 6;
  };

  drawSection(ar, "ar");
  checkY(18);
  drawSection(ap, "ap");

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont(F, "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(T.footer, ML, FOOTER_Y);
    doc.text(i + " / " + pages, PAGE_W - MR, FOOTER_Y, { align: "right" });
  }

  doc.save(contact.name + " - AR AP Statement.pdf");
}

function totalsFor(items: ARItem[]) {
  return items.reduce((acc, r) => {
    if (r.status === "settled") return acc;
    const code = r.currency.code;
    if (!acc[code]) acc[code] = { symbol: r.currency.symbol, remaining: 0 };
    acc[code].remaining += r.remainingAmount;
    return acc;
  }, {} as Record<string, { symbol: string; remaining: number }>);
}

// ─── Table totals helper ─────────────────────────────────────────────────────
function tableTotals(items: ARItem[]) {
  return items.reduce((acc, r) => {
    const code = r.currency.code;
    if (!acc[code]) acc[code] = { symbol: r.currency.symbol, original: 0, paid: 0, remaining: 0 };
    acc[code].original += r.originalAmount;
    acc[code].paid += r.paidAmount;
    acc[code].remaining += r.remainingAmount;
    return acc;
  }, {} as Record<string, { symbol: string; original: number; paid: number; remaining: number }>);
}

// ─── Reusable items table ────────────────────────────────────────────────────
function ItemsTable({
  items, type, expanded, onToggle, onEdit, onDelete, onPayOpen, onMarkSettled,
  onDeletePayment, onTriggerAttach, onReplaceRecordAttach, onRemoveRecordAttach,
  onRemovePaymentAttach, onViewAttachment, uploading, uploadingPaymentId, uploadingRecordId,
}: {
  items: ARItem[];
  type: "ar" | "ap";
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (item: ARItem) => void;
  onDelete: (id: string) => void;
  onPayOpen: (item: ARItem) => void;
  onMarkSettled: (item: ARItem) => void;
  onDeletePayment: (itemId: string, paymentId: string) => void;
  onTriggerAttach: (itemId: string, paymentId: string) => void;
  onReplaceRecordAttach: (itemId: string) => void;
  onRemoveRecordAttach: (itemId: string) => void;
  onRemovePaymentAttach: (itemId: string, paymentId: string) => void;
  onViewAttachment: (url: string) => void;
  uploading: boolean;
  uploadingPaymentId: string | null;
  uploadingRecordId: string | null;
}) {
  const now = new Date();
  const [pendingDeletePayment, setPendingDeletePayment] = useState<string | null>(null);
  // uploadingPaymentId comes from parent so we know exactly which row is uploading
  const isOverdue = (r: ARItem) => r.dueDate && new Date(r.dueDate) < now && r.status !== "settled";
  const accentPaid = type === "ar" ? "text-green-600" : "text-blue-600";
  const accentRemaining = type === "ar" ? "text-slate-800" : "text-red-600";
  const progressColor = type === "ar" ? "bg-green-500" : "bg-blue-500";
  const totals = tableTotals(items);

  if (items.length === 0) {
    return <p className="text-center text-slate-400 text-sm py-6">No {type === "ar" ? "receivables" : "payables"} yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-3 font-medium text-slate-500 whitespace-nowrap">Agreed</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-500">Description</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-500">CCY</th>
              <th className="text-right py-2 pr-3 font-medium text-slate-500">Original</th>
              <th className="text-right py-2 pr-3 font-medium text-slate-500">{type === "ar" ? "Received" : "Paid"}</th>
              <th className="text-right py-2 pr-3 font-medium text-slate-500">Remaining</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-500">Progress</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-500">Status</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-500">Due</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map(r => {
              const pct = Math.min(100, r.originalAmount > 0 ? (r.paidAmount / r.originalAmount) * 100 : 0);
              const overdue = isOverdue(r);
              const isExp = expanded.has(r.id);
              return (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-slate-50 hover:bg-slate-50 group">
                    <td className="py-2 pr-3 text-xs text-slate-600 font-medium whitespace-nowrap">{formatDate(r.agreementDate)}</td>
                    <td className="py-2 pr-3 text-slate-600 max-w-[130px]">
                      <span className="flex items-center gap-1 truncate">
                        <span className="truncate">{r.description || <span className="text-slate-300">—</span>}</span>
                        {r.attachmentUrl && (
                          <span className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => onViewAttachment(r.attachmentUrl!)}
                              title="View document"
                              className="p-0.5 rounded bg-blue-50 text-blue-500 hover:bg-blue-100">
                              <Paperclip className="h-3.5 w-3.5" />
                            </button>
                            <button disabled={uploading} onClick={() => onReplaceRecordAttach(r.id)}
                              title="Replace document"
                              className="p-0.5 rounded bg-slate-100 text-slate-400 hover:bg-slate-200 disabled:opacity-40">
                              {uploadingRecordId === r.id
                                ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                : <Upload className="h-3 w-3" />}
                            </button>
                            <button onClick={() => onRemoveRecordAttach(r.id)}
                              title="Remove document"
                              className="p-0.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-medium">{r.currency.code}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{formatAmount(r.originalAmount, r.currency.symbol)}</td>
                    <td className={`py-2 pr-3 text-right ${accentPaid}`}>{formatAmount(r.paidAmount, r.currency.symbol)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${accentRemaining}`}>{formatAmount(r.remainingAmount, r.currency.symbol)}</td>
                    <td className="py-2 pr-3 min-w-[80px]">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
                        <div className={`h-full ${progressColor} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{Math.round(pct)}%</span>
                    </td>
                    <td className="py-2 pr-3"><Badge variant={statusVariant[r.status]}>{r.status}</Badge></td>
                    <td className={`py-2 pr-3 text-xs ${overdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
                      {overdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
                      {r.dueDate ? getAgingLabel(r.dueDate) : "—"}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        {r.status !== "settled" && (<>
                          <Button size="sm" variant={type === "ar" ? "success" : "default"}
                            onClick={() => onPayOpen(r)}>+ Pay</Button>
                          <button title="Mark settled" onClick={() => onMarkSettled(r)}
                            className="p-1 rounded hover:bg-green-50 text-slate-300 hover:text-green-600 transition-colors">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </>)}
                        {r.payments.length > 0 && (
                          <button onClick={() => onToggle(r.id)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                            {isExp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        <button onClick={() => onEdit(r)} className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onDelete(r.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                {isExp && r.payments.length > 0 && (
                  <tr>
                    <td colSpan={10} className="pb-3 pt-1 pl-4">
                      <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-medium text-slate-400 mb-2">Payment History — {r.currency.code}</p>
                        {r.payments.map(p => (
                          <div key={p.id} className="flex justify-between items-center text-xs text-slate-600 py-1.5 border-b border-slate-100 last:border-0">
                            <span className="flex-1 min-w-0 truncate mr-2">{formatDate(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`font-medium ${accentPaid} mr-1`}>{formatAmount(p.amount, r.currency.symbol)}</span>
                              {p.attachmentUrl && (
                                <>
                                  <button onClick={() => onViewAttachment(p.attachmentUrl!)}
                                    title="View attachment"
                                    className="p-1 rounded bg-blue-50 text-blue-500 hover:bg-blue-100">
                                    <Paperclip className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => onRemovePaymentAttach(r.id, p.id)}
                                    title="Remove attachment"
                                    className="p-1 rounded text-slate-300 hover:text-orange-500 hover:bg-orange-50">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              <button disabled={uploading} onClick={() => onTriggerAttach(r.id, p.id)}
                                title={p.attachmentUrl ? "Replace attachment" : "Attach payment slip"}
                                className="p-1 rounded bg-slate-100 text-slate-400 hover:bg-slate-200 disabled:opacity-40">
                                {uploadingPaymentId === p.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                                  : <Upload className="h-3.5 w-3.5" />}
                              </button>
                              {pendingDeletePayment === p.id ? (
                                <span className="flex items-center gap-1">
                                  <button
                                    onClick={() => { onDeletePayment(r.id, p.id); setPendingDeletePayment(null); }}
                                    className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-500 text-white hover:bg-red-600">
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setPendingDeletePayment(null)}
                                    className="p-1 rounded text-slate-400 hover:bg-slate-100">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              ) : (
                                <button onClick={() => setPendingDeletePayment(p.id)}
                                  title="Delete payment"
                                  className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
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

    {/* Totals summary per currency */}
    <div className="space-y-1.5">
      {Object.entries(totals).map(([code, t]) => (
        <div key={code} className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm">
          <span className="font-bold text-slate-700 w-10 shrink-0">{code}</span>
          <div className="flex gap-6 flex-wrap">
            <span className="text-slate-400">Original <span className="font-medium text-slate-700">{formatAmount(t.original, t.symbol)}</span></span>
            <span className={type === "ar" ? "text-green-600" : "text-blue-600"}>
              {type === "ar" ? "Received" : "Paid"} <span className="font-semibold">{formatAmount(t.paid, t.symbol)}</span>
            </span>
            <span className={type === "ar" ? "text-slate-800 font-bold" : "text-red-600 font-bold"}>
              Remaining {formatAmount(t.remaining, t.symbol)}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function LedgerPage() {
  const { toast } = useToast();

  const [receivables, setReceivables] = useState<ARItem[]>([]);
  const [payables, setPayables] = useState<APItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<Record<string, "ar" | "ap">>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"ar" | "ap">("ar");
  const [editRecord, setEditRecord] = useState<ARItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: "ar" | "ap" } | null>(null);
  const [payDialog, setPayDialog] = useState<{ item: ARItem; type: "ar" | "ap" } | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), note: "" });
  const [payFile, setPayFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachingPayment, setAttachingPayment] = useState<{ itemId: string; paymentId: string; type: "ar" | "ap" } | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [attachingRecord, setAttachingRecord] = useState<{ itemId: string; type: "ar" | "ap" } | null>(null);
  const attachRecordRef = useRef<HTMLInputElement>(null);
  const [settleDialog, setSettleDialog] = useState<{ item: ARItem; type: "ar" | "ap" } | null>(null);
  const [settleFile, setSettleFile] = useState<File | null>(null);
  const [settleNote, setSettleNote] = useState("Settlement");
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [attachViewer, setAttachViewer] = useState<{ url: string; isImage: boolean } | null>(null);

  function viewAttachment(rawUrl: string) {
    const result = toBlobUrl(rawUrl);
    if (result) setAttachViewer({ url: result.blobUrl, isImage: result.isImage });
  }
  function closeViewer() {
    if (attachViewer?.url.startsWith("blob:")) URL.revokeObjectURL(attachViewer.url);
    setAttachViewer(null);
  }

  function fetchAll() {
    fetch("/api/receivables").then(r => r.json()).then(d => { if (Array.isArray(d)) setReceivables(d); });
    fetch("/api/payables").then(r => r.json()).then(d => { if (Array.isArray(d)) setPayables(d); });
  }

  useEffect(() => {
    fetchAll();
    fetch("/api/contacts").then(r => r.json()).then(d => { if (Array.isArray(d)) setContacts(d); });
    fetch("/api/currencies").then(r => r.json()).then(d => { if (Array.isArray(d)) setCurrencies(d); });
  }, []);

  // Group AR and AP by contact
  const allContactIds = Array.from(new Set([
    ...receivables.map(r => r.contact.id),
    ...payables.map(p => p.contact.id),
    ...contacts.map(c => c.id),
  ]));

  const contactMap = new Map<string, Contact>();
  [...receivables.map(r => r.contact), ...payables.map(p => p.contact), ...contacts].forEach(c => contactMap.set(c.id, c));

  const grouped = allContactIds
    .map(id => ({
      contact: contactMap.get(id)!,
      ar: receivables.filter(r => r.contact.id === id),
      ap: payables.filter(p => p.contact.id === id),
    }))
    .filter(g => g.contact && (g.ar.length > 0 || g.ap.length > 0));

  function toggleContact(id: string) {
    setExpandedContacts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    if (!activeTab[id]) setActiveTab(prev => ({ ...prev, [id]: "ar" }));
  }

  function toggleItem(id: string) {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openAdd(type: "ar" | "ap", contactId: string) {
    setDialogType(type);
    setEditRecord(null);
    setForm(emptyForm(contactId));
    setRecordFile(null);
    setDialogOpen(true);
  }

  function openAddTop() {
    setDialogType("ar");
    setEditRecord(null);
    setForm(emptyForm());
    setRecordFile(null);
    setDialogOpen(true);
  }

  function openEdit(item: ARItem, type: "ar" | "ap") {
    setDialogType(type);
    setEditRecord(item);
    setForm({
      contactId: item.contact.id, currencyId: item.currency.id,
      originalAmount: String(item.originalAmount), description: item.description ?? "",
      agreementDate: item.agreementDate.slice(0, 10), dueDate: item.dueDate?.slice(0, 10) ?? "",
      note: item.note ?? "",
    });
    setRecordFile(null);
    setDialogOpen(true);
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
    const base = dialogType === "ar" ? "/api/receivables" : "/api/payables";
    const url = editRecord ? `${base}/${editRecord.id}` : base;
    const method = editRecord ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, originalAmount: parseFloat(form.originalAmount), ...(attachmentUrl !== undefined && { attachmentUrl }) }),
    });
    setLoading(false);
    if (res.ok) {
      toast(editRecord ? "Updated" : "Created");
      setDialogOpen(false); setEditRecord(null); setForm(emptyForm()); setRecordFile(null); fetchAll();
    } else {
      const d = await res.json();
      toast(d.error ?? "Failed to save", "error");
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    const base = deleteConfirm.type === "ar" ? "/api/receivables" : "/api/payables";
    const res = await fetch(`${base}/${deleteConfirm.id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    if (res.ok) { toast("Deleted"); fetchAll(); }
    else { const d = await res.json(); toast(d.error ?? "Failed to delete", "error"); }
  }

  async function handleConfirmSettle() {
    if (!settleDialog) return;
    const { item, type } = settleDialog;
    setLoading(true);
    let attachmentUrl: string | null = null;
    if (settleFile) {
      setUploading(true);
      attachmentUrl = await uploadFile(settleFile);
      setUploading(false);
      if (!attachmentUrl) { toast("File upload failed", "error"); setLoading(false); return; }
    }
    const base = type === "ar" ? "/api/receivables" : "/api/payables";
    const res = await fetch(`${base}/${item.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: item.remainingAmount, date: settleDate, note: settleNote || "Settlement", attachmentUrl }),
    });
    setLoading(false);
    if (res.ok) {
      const updated = await res.json();
      if (type === "ar") setReceivables(prev => prev.map(x => x.id === item.id ? updated : x));
      else setPayables(prev => prev.map(x => x.id === item.id ? updated : x));
      toast("Settled");
      setSettleDialog(null); setSettleFile(null);
    } else {
      const d = await res.json(); toast(d.error ?? "Failed", "error");
    }
  }

  async function handlePayment() {
    if (!payDialog) return;
    setLoading(true);
    let attachmentUrl: string | null = null;
    if (payFile) {
      setUploading(true);
      attachmentUrl = await uploadFile(payFile);
      setUploading(false);
      if (!attachmentUrl) { toast("File upload failed", "error"); setLoading(false); return; }
    }
    const base = payDialog.type === "ar" ? "/api/receivables" : "/api/payables";
    const res = await fetch(`${base}/${payDialog.item.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(payForm.amount), date: payForm.date, note: payForm.note, attachmentUrl }),
    });
    setLoading(false);
    if (res.ok) {
      const updated = await res.json();
      if (payDialog.type === "ar") setReceivables(prev => prev.map(x => x.id === payDialog.item.id ? updated : x));
      else setPayables(prev => prev.map(x => x.id === payDialog.item.id ? updated : x));
      toast("Payment logged");
      setPayDialog(null); setPayFile(null);
      setPayForm({ amount: "", date: new Date().toISOString().slice(0, 10), note: "" });
    } else {
      const d = await res.json(); toast(d.error ?? "Failed", "error");
    }
  }

  async function handleDeletePayment(itemId: string, paymentId: string, type: "ar" | "ap") {
    const base = type === "ar" ? "/api/receivables" : "/api/payables";
    const res = await fetch(`${base}/${itemId}/payments/${paymentId}`, { method: "DELETE" });
    if (res.ok) {
      const updated = await res.json();
      if (type === "ar") setReceivables(prev => prev.map(x => x.id === itemId ? updated : x));
      else setPayables(prev => prev.map(x => x.id === itemId ? updated : x));
      toast("Payment removed");
    }
  }

  function triggerAttach(itemId: string, paymentId: string, type: "ar" | "ap") {
    setAttachingPayment({ itemId, paymentId, type });
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
    const { itemId, paymentId, type } = attachingPayment;
    const base = type === "ar" ? "/api/receivables" : "/api/payables";
    const res = await fetch(`${base}/${itemId}/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrl: url }),
    });
    setAttachingPayment(null);
    if (res.ok) {
      const setter = type === "ar" ? setReceivables : setPayables;
      setter((prev: ARItem[]) => prev.map(x => x.id === itemId ? {
        ...x, payments: x.payments.map(p => p.id === paymentId ? { ...p, attachmentUrl: url } : p),
      } : x));
      toast("Slip attached");
      viewAttachment(url);
    } else {
      toast("Failed to save attachment", "error");
    }
  }

  // ── Record-level attachment handlers ────────────────────────────────────────

  function triggerReplaceRecord(itemId: string, type: "ar" | "ap") {
    setAttachingRecord({ itemId, type });
    attachRecordRef.current?.click();
  }

  async function handleAttachRecordFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !attachingRecord) return;
    e.target.value = "";
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (!url) { toast("Upload failed", "error"); setAttachingRecord(null); return; }
    const { itemId, type } = attachingRecord;
    const base = type === "ar" ? "/api/receivables" : "/api/payables";
    const res = await fetch(`${base}/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrl: url }),
    });
    setAttachingRecord(null);
    if (res.ok) {
      const setter = type === "ar" ? setReceivables : setPayables;
      setter(prev => prev.map(x => x.id === itemId ? { ...x, attachmentUrl: url } : x));
      toast("Document replaced");
      viewAttachment(url);
    } else {
      toast("Failed to save", "error");
    }
  }

  async function handleRemoveRecordAttach(itemId: string, type: "ar" | "ap") {
    const base = type === "ar" ? "/api/receivables" : "/api/payables";
    const res = await fetch(`${base}/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrl: null }),
    });
    if (res.ok) {
      const setter = type === "ar" ? setReceivables : setPayables;
      setter(prev => prev.map(x => x.id === itemId ? { ...x, attachmentUrl: null } : x));
      toast("Attachment removed");
    } else {
      toast("Failed to remove", "error");
    }
  }

  async function handleRemovePaymentAttach(itemId: string, paymentId: string, type: "ar" | "ap") {
    const base = type === "ar" ? "/api/receivables" : "/api/payables";
    const res = await fetch(`${base}/${itemId}/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentUrl: null }),
    });
    if (res.ok) {
      const setter = type === "ar" ? setReceivables : setPayables;
      setter(prev => prev.map(x => x.id === itemId ? {
        ...x,
        payments: x.payments.map(p => p.id === paymentId ? { ...p, attachmentUrl: null } : p),
      } : x));
      toast("Attachment removed");
    } else {
      toast("Failed to remove", "error");
    }
  }


  return (
    <div className="space-y-6 animate-fade-in">
      <input ref={attachInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden" onChange={handleAttachFile} />
      <input ref={attachRecordRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden" onChange={handleAttachRecordFile} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AR / AP Ledger</h1>
          <p className="text-slate-500 text-sm mt-1">Click a contact to view and manage their receivables and payables</p>
        </div>
        <Button onClick={openAddTop}>
          <Plus className="h-4 w-4 mr-1.5" />Add Entry
        </Button>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No records yet. Add contacts first, then create AR or AP entries.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ contact, ar, ap }) => {
            const isOpen = expandedContacts.has(contact.id);
            const tab = activeTab[contact.id] ?? "ar";
            const arTotals = totalsFor(ar);
            const apTotals = totalsFor(ap);
            const arOpen = ar.filter(r => r.status !== "settled").length;
            const apOpen = ap.filter(p => p.status !== "settled").length;

            return (
              <div key={contact.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Contact header */}
                <div className="flex items-center px-5 py-4 hover:bg-slate-50 transition-colors">
                  <button
                    onClick={() => toggleContact(contact.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">{contact.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{contact.name}</p>
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        {arOpen > 0 && (
                          <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {Object.entries(arTotals).map(([code, d]) =>
                              `${code} ${formatAmount(d.remaining, d.symbol)}`
                            ).join(" · ") || `${arOpen} AR`}
                          </span>
                        )}
                        {apOpen > 0 && (
                          <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {Object.entries(apTotals).map(([code, d]) =>
                              `${code} ${formatAmount(d.remaining, d.symbol)}`
                            ).join(" · ") || `${apOpen} AP`}
                          </span>
                        )}
                        {arOpen === 0 && apOpen === 0 && (
                          <span className="text-xs text-slate-400">All settled</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => downloadContactPDF(contact, ar, ap, "en")}
                      title="Download PDF (English)"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors border border-blue-200"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={() => downloadContactPDF(contact, ar, ap, "lo")}
                      title="Download PDF (ພາສາລາວ)"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      ລາວ
                    </button>
                    <button onClick={() => toggleContact(contact.id)} className="p-1 rounded hover:bg-slate-100">
                      {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 px-5">
                      <button
                        onClick={() => setActiveTab(prev => ({ ...prev, [contact.id]: "ar" }))}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                          tab === "ar" ? "border-green-500 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        Receivables (AR)
                        {arOpen > 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 rounded-full px-1.5">{arOpen}</span>}
                      </button>
                      <button
                        onClick={() => setActiveTab(prev => ({ ...prev, [contact.id]: "ap" }))}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                          tab === "ap" ? "border-red-500 text-red-700" : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <TrendingDown className="h-3.5 w-3.5" />
                        Payables (AP)
                        {apOpen > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 rounded-full px-1.5">{apOpen}</span>}
                      </button>
                    </div>

                    {/* Tab content */}
                    <div className="px-5 py-4">
                      <div className="flex justify-end mb-3">
                        <Button size="sm" variant={tab === "ar" ? "success" : "default"}
                          onClick={() => openAdd(tab, contact.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add {tab === "ar" ? "Receivable" : "Payable"}
                        </Button>
                      </div>
                      <ItemsTable
                        items={tab === "ar" ? ar : ap}
                        type={tab}
                        expanded={expandedItems}
                        onToggle={toggleItem}
                        onEdit={(item) => openEdit(item, tab)}
                        onDelete={(id) => setDeleteConfirm({ id, type: tab })}
                        onPayOpen={(item) => {
                          setPayDialog({ item, type: tab });
                          setPayForm({ amount: String(item.remainingAmount), date: new Date().toISOString().slice(0, 10), note: "" });
                          setPayFile(null);
                        }}
                        onMarkSettled={(item) => {
                          setSettleDialog({ item, type: tab });
                          setSettleNote("Settlement");
                          setSettleDate(new Date().toISOString().slice(0, 10));
                          setSettleFile(null);
                        }}
                        onDeletePayment={(itemId, paymentId) => handleDeletePayment(itemId, paymentId, tab)}
                        onTriggerAttach={(itemId, paymentId) => triggerAttach(itemId, paymentId, tab)}
                        onReplaceRecordAttach={(itemId) => triggerReplaceRecord(itemId, tab)}
                        onRemoveRecordAttach={(itemId) => handleRemoveRecordAttach(itemId, tab)}
                        onRemovePaymentAttach={(itemId, paymentId) => handleRemovePaymentAttach(itemId, paymentId, tab)}
                        onViewAttachment={viewAttachment}
                        uploading={uploading}
                        uploadingPaymentId={uploading && attachingPayment ? attachingPayment.paymentId : null}
                        uploadingRecordId={uploading && attachingRecord ? attachingRecord.itemId : null}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) { setEditRecord(null); setForm(emptyForm()); setRecordFile(null); } }}>
        {/* flex flex-col + overflow-hidden so only the body scrolls, footer stays fixed */}
        <DialogContent className="flex flex-col overflow-hidden p-0 gap-0">
          {/* Fixed header */}
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
            <DialogTitle>
              {editRecord ? "Edit" : "New"} {dialogType === "ar" ? "Receivable" : "Payable"}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4">
            <form id="ledger-form" onSubmit={handleSubmit} className="space-y-4">
              {!editRecord && (
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setDialogType("ar")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      dialogType === "ar"
                        ? "bg-green-50 border-green-400 text-green-700"
                        : "border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}>
                    <TrendingUp className="h-4 w-4" /> Receivable (AR)
                  </button>
                  <button type="button"
                    onClick={() => setDialogType("ap")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      dialogType === "ap"
                        ? "bg-red-50 border-red-400 text-red-700"
                        : "border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}>
                    <TrendingDown className="h-4 w-4" /> Payable (AP)
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Contact</Label>
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
                <Label>Document (optional)</Label>
                {editRecord?.attachmentUrl && !recordFile ? (
                  <div className="flex items-center gap-2 text-sm">
                    <button type="button" onClick={() => viewAttachment(editRecord.attachmentUrl!)}
                      className="flex items-center gap-1.5 text-blue-500 hover:text-blue-700">
                      <Paperclip className="h-4 w-4" />View document
                    </button>
                    <label className="text-slate-500 cursor-pointer underline text-xs ml-2">
                      Replace
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                        onChange={e => setRecordFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                    <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-500 truncate">
                      {recordFile ? recordFile.name : "Attach JPG, PNG, or PDF"}
                    </span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                      onChange={e => setRecordFile(e.target.files?.[0] ?? null)} />
                  </label>
                )}
                {recordFile && (
                  <button type="button" onClick={() => setRecordFile(null)} className="text-xs text-red-400 flex items-center gap-1">
                    <X className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Fixed footer — always visible, never scrolls away */}
          <div className="px-5 py-4 border-t border-slate-100 shrink-0">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" form="ledger-form"
                disabled={loading || uploading || !form.contactId || (!editRecord && !form.currencyId) || !form.originalAmount}>
                {uploading ? "Uploading..." : loading ? "Saving..." : editRecord ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete this record?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">This will permanently delete all payment history for this record.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle confirmation dialog */}
      <Dialog open={!!settleDialog} onOpenChange={v => { if (!v) { setSettleDialog(null); setSettleFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Settlement</DialogTitle>
          </DialogHeader>
          {settleDialog && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact</span>
                  <span className="font-medium">{settleDialog.item.contact.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium">{settleDialog.type === "ar" ? "Receivable (AR)" : "Payable (AP)"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount to settle</span>
                  <span className="font-bold text-green-700 text-base">
                    {formatAmount(settleDialog.item.remainingAmount, settleDialog.item.currency.symbol)} {settleDialog.item.currency.code}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Settlement Date</Label>
                <Input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Input placeholder="e.g. Final payment, cash" value={settleNote} onChange={e => setSettleNote(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Attach Receipt / Slip (optional)</Label>
                <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                  <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500 truncate">
                    {settleFile ? settleFile.name : "Attach payment slip or receipt"}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                    onChange={e => setSettleFile(e.target.files?.[0] ?? null)} />
                </label>
                {settleFile && (
                  <button type="button" onClick={() => setSettleFile(null)} className="text-xs text-red-400 flex items-center gap-1">
                    <X className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSettleDialog(null); setSettleFile(null); }}>Cancel</Button>
            <Button variant="success" disabled={loading || uploading} onClick={handleConfirmSettle}>
              {uploading ? "Uploading..." : loading ? "Settling..." : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!payDialog} onOpenChange={() => { setPayDialog(null); setPayFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{payDialog?.type === "ar" ? "Log Payment Received" : "Log Payment Made"}</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Contact</span><span className="font-medium">{payDialog.item.contact.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Currency</span><span className="font-medium">{payDialog.item.currency.code}</span></div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining</span>
                  <span className={`font-semibold ${payDialog.type === "ar" ? "text-green-600" : "text-red-600"}`}>
                    {formatAmount(payDialog.item.remainingAmount, payDialog.item.currency.symbol)}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Amount ({payDialog.item.currency.code})</Label>
                <AmountInput placeholder="0" value={payForm.amount}
                  onChange={v => setPayForm(f => ({ ...f, amount: v }))} />
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
                <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                  <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500 truncate">{payFile ? payFile.name : "Attach slip (optional)"}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                    onChange={e => setPayFile(e.target.files?.[0] ?? null)} />
                </label>
                {payFile && <button onClick={() => setPayFile(null)} className="text-xs text-red-400 flex items-center gap-1"><X className="h-3 w-3" />Remove</button>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayDialog(null); setPayFile(null); }}>Cancel</Button>
            <Button variant={payDialog?.type === "ar" ? "success" : "default"}
              disabled={loading || uploading || !payForm.amount} onClick={handlePayment}>
              {uploading ? "Uploading..." : loading ? "Saving..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Inline attachment viewer ── */}
      {attachViewer && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80"
          onClick={closeViewer}
        >
          <div
            className="relative bg-white w-full sm:w-auto sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ maxWidth: "min(96vw, 720px)", maxHeight: "92vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 shrink-0">
              <span className="text-white text-sm font-semibold">
                {attachViewer.isImage ? "Photo / Image" : "PDF Document"}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={attachViewer.url}
                  download="attachment"
                  className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <FileDown className="h-4 w-4" /> Download
                </a>
                <button
                  onClick={closeViewer}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            {attachViewer.isImage ? (
              <div className="overflow-auto bg-slate-100 flex items-center justify-center" style={{ minHeight: "40vh", maxHeight: "80vh" }}>
                <img
                  src={attachViewer.url}
                  alt="Attachment"
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: "80vh" }}
                />
              </div>
            ) : (
              <div className="flex flex-col" style={{ height: "75vh" }}>
                <iframe
                  src={attachViewer.url}
                  title="Document"
                  className="flex-1 w-full bg-white"
                />
                {/* Fallback hint for mobile PDF */}
                <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2 shrink-0">
                  <span>PDF not displaying?</span>
                  <a href={attachViewer.url} download="attachment"
                    className="font-semibold underline" onClick={e => e.stopPropagation()}>
                    Tap here to download
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
