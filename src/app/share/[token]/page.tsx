"use client";

import { Fragment, use, useEffect, useState } from "react";
import { Lock, Loader2, Paperclip, TrendingUp, TrendingDown, X, ShieldCheck, FileText } from "lucide-react";
import { formatAmount } from "@/lib/utils";

interface Ccy { code: string; symbol: string }
interface Payment { id: string; amount: number; date: string; note: string | null; attachmentUrl: string | null; currency: Ccy }
interface LedgerRecord {
  id: string; originalAmount: number; paidAmount: number; remainingAmount: number;
  status: string; description: string | null; agreementDate: string; dueDate: string | null;
  note: string | null; attachmentUrl: string | null; currency: Ccy; payments: Payment[];
}
interface LedgerData {
  contact: { name: string };
  receivables: LedgerRecord[];
  payables: LedgerRecord[];
  generatedAt: string;
}

const dict = {
  en: {
    enterPin: "Enter PIN to view", pinHint: "This statement is protected. Enter the PIN you were given.",
    view: "View statement", checking: "Checking link…", wrong: "Incorrect PIN.",
    ar: "Receivables — owed to you", ap: "Payables — you owe",
    summaryTitle: "Summary", owesYou: "Owed to you", youOwe: "You owe", nothing: "—",
    date: "Agreed", desc: "Description", ccy: "CCY", orig: "Original", paid: "Paid", recv: "Received", rem: "Remaining",
    status: "Status", due: "Due", none: "No records.", total: "Total", payment: "Payment",
    s_open: "Open", s_partial: "Partial", s_settled: "Fully paid",
    doc: "Document", viewDoc: "View", generated: "Generated", secured: "Private & read-only",
  },
  lo: {
    enterPin: "ໃສ່ລະຫັດ PIN ເພື່ອເບິ່ງ", pinHint: "ເອກະສານນີ້ຖືກປ້ອງກັນ. ກະລຸນາໃສ່ລະຫັດ PIN ທີ່ທ່ານໄດ້ຮັບ.",
    view: "ເບິ່ງລາຍງານ", checking: "ກຳລັງກວດ…", wrong: "ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ.",
    ar: "ຄ້າງຮັບ — ເຂົາຄ້າງທ່ານ", ap: "ຄ້າງຈ່າຍ — ທ່ານຄ້າງເຂົາ",
    summaryTitle: "ສະຫຼຸບ", owesYou: "ເຂົາຄ້າງທ່ານ", youOwe: "ທ່ານຄ້າງ", nothing: "—",
    date: "ວັນທີ", desc: "ລາຍການ", ccy: "ສະກຸນ", orig: "ຈຳນວນ", paid: "ຈ່າຍແລ້ວ", recv: "ຮັບແລ້ວ", rem: "ຍັງຄ້າງ",
    status: "ສະຖານະ", due: "ກຳນົດ", none: "ບໍ່ມີຂໍ້ມູນ.", total: "ລວມ", payment: "ຊຳລະ",
    s_open: "ຄ້າງ", s_partial: "ບາງສ່ວນ", s_settled: "ຈ່າຍຄົບ",
    doc: "ເອກະສານ", viewDoc: "ເບິ່ງ", generated: "ສ້າງເມື່ອ", secured: "ສ່ວນຕົວ & ອ່ານຢ່າງດຽວ",
  },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function sumRemaining(items: LedgerRecord[]) {
  const m: Map<string, { v: number; symbol: string }> = new Map();
  for (const it of items) {
    if (it.remainingAmount <= 0) continue;
    const cur = m.get(it.currency.code) ?? { v: 0, symbol: it.currency.symbol };
    cur.v += it.remainingAmount;
    m.set(it.currency.code, cur);
  }
  return m;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [lang, setLang] = useState<"en" | "lo">("en");
  const T = dict[lang];

  const [phase, setPhase] = useState<"loading" | "pin" | "unlocked" | "dead">("loading");
  const [contactName, setContactName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<LedgerData | null>(null);
  const [viewer, setViewer] = useState<{ url: string; isImage: boolean } | null>(null);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async r => {
        if (!r.ok) { setPhase("dead"); return; }
        const d = await r.json();
        setContactName(d.contactName);
        setPhase("pin");
      })
      .catch(() => setPhase("dead"));
  }, [token]);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) { setError(T.wrong); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? T.wrong); setSubmitting(false); return; }
      setData(d);
      setPhase("unlocked");
    } catch {
      setError(T.wrong); setSubmitting(false);
    }
  }

  function openDoc(url: string) {
    setViewer({ url, isImage: url.startsWith("data:image") || /\.(jpg|jpeg|png|webp)$/i.test(url) });
  }

  // ── Loading / dead-link states ──────────────────────────────────────────────
  if (phase === "loading")
    return <Centered><Loader2 className="h-6 w-6 animate-spin text-slate-400" /><p className="text-slate-400 text-sm mt-3">{T.checking}</p></Centered>;

  if (phase === "dead")
    return <Centered><div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center"><Lock className="h-5 w-5 text-slate-400" /></div>
      <p className="text-slate-600 font-medium mt-4">This link is no longer active.</p>
      <p className="text-slate-400 text-sm mt-1">Ask the sender for a new link.</p></Centered>;

  // ── PIN gate ────────────────────────────────────────────────────────────────
  if (phase === "pin")
    return (
      <Centered>
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex justify-end -mt-1 -mr-1"><LangToggle lang={lang} setLang={setLang} /></div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto"><Lock className="h-5 w-5 text-blue-600" /></div>
          <h1 className="text-lg font-bold text-slate-800 text-center mt-4">{contactName}</h1>
          <p className="text-sm font-medium text-slate-600 text-center mt-3">{T.enterPin}</p>
          <p className="text-xs text-slate-400 text-center mt-1">{T.pinHint}</p>
          <form onSubmit={submitPin} className="mt-5 space-y-3">
            <input
              autoFocus inputMode="numeric" pattern="\d*" maxLength={6} value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
              placeholder="••••"
              className="w-full text-center text-2xl tracking-[0.5em] font-bold py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button type="submit" disabled={submitting || pin.length < 4}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {T.view}
            </button>
          </form>
        </div>
      </Centered>
    );

  // ── Unlocked ledger ─────────────────────────────────────────────────────────
  const d = data!;
  const arRem = sumRemaining(d.receivables);
  const apRem = sumRemaining(d.payables);
  const fmtMap = (m: ReturnType<typeof sumRemaining>) =>
    m.size ? [...m.entries()].map(([code, x]) => `${formatAmount(x.v, x.symbol)} ${code}`).join("  ·  ") : T.nothing;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800 text-white rounded-t-2xl px-5 sm:px-7 py-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">AR / AP Statement</p>
            <h1 className="text-xl sm:text-2xl font-bold mt-0.5">{d.contact.name}</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <LangToggle lang={lang} setLang={setLang} dark />
            <span className="text-[10px] text-slate-400 flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{T.secured}</span>
          </div>
        </div>

        <div className="bg-white rounded-b-2xl shadow-sm px-5 sm:px-7 py-5">
          {/* Net-position summary */}
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl bg-blue-50 border border-blue-100 border-l-[3px] border-l-blue-600 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{T.owesYou}</p>
              <p className="text-lg font-bold text-blue-700 mt-0.5">{fmtMap(arRem)}</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 border-l-[3px] border-l-red-600 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{T.youOwe}</p>
              <p className="text-lg font-bold text-red-700 mt-0.5">{fmtMap(apRem)}</p>
            </div>
          </div>

          <Section title={T.ar} items={d.receivables} isAR T={T} onDoc={openDoc} />
          <div className="h-6" />
          <Section title={T.ap} items={d.payables} isAR={false} T={T} onDoc={openDoc} />

          <p className="text-[10px] text-slate-400 mt-8 pt-3 border-t border-slate-100">
            {T.generated} {fmtDate(d.generatedAt)} · Catdy&apos;s AR AP Tracker
          </p>
        </div>
      </div>

      {/* Attachment viewer */}
      {viewer && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setViewer(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                {viewer.isImage ? <Paperclip className="h-4 w-4" /> : <FileText className="h-4 w-4" />} {T.doc}
              </span>
              <div className="flex items-center gap-3">
                <a href={viewer.url} download className="text-xs text-blue-600 hover:underline">Download</a>
                <button onClick={() => setViewer(null)}><X className="h-4 w-4 text-slate-400" /></button>
              </div>
            </div>
            <div className="overflow-auto p-2 bg-slate-50">
              {viewer.isImage
                ? <img src={viewer.url} alt="attachment" className="max-w-full mx-auto rounded" />
                : <iframe src={viewer.url} className="w-full h-[70vh] rounded" title="document" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center px-4 text-center">{children}</div>;
}

function LangToggle({ lang, setLang, dark }: { lang: "en" | "lo"; setLang: (l: "en" | "lo") => void; dark?: boolean }) {
  return (
    <div className={`flex rounded-lg overflow-hidden text-[11px] font-medium border ${dark ? "border-slate-600" : "border-slate-200"}`}>
      {(["en", "lo"] as const).map(l => (
        <button key={l} onClick={() => setLang(l)}
          className={`px-2 py-0.5 ${lang === l ? "bg-blue-600 text-white" : dark ? "text-slate-300" : "text-slate-500"}`}>
          {l === "en" ? "EN" : "ລາວ"}
        </button>
      ))}
    </div>
  );
}

function statusLabel(status: string, T: typeof dict["en"]) {
  return status === "settled" ? T.s_settled : status === "partial" ? T.s_partial : T.s_open;
}

function Section({ title, items, isAR, T, onDoc }: {
  title: string; items: LedgerRecord[]; isAR: boolean; T: typeof dict["en"]; onDoc: (url: string) => void;
}) {
  const accent = isAR ? "text-blue-700 bg-blue-50 border-l-blue-600" : "text-red-700 bg-red-50 border-l-red-600";
  const remColor = isAR ? "text-blue-700" : "text-red-700";
  const totals: Map<string, { orig: number; paid: number; rem: number; symbol: string }> = new Map();
  for (const it of items) {
    const t = totals.get(it.currency.code) ?? { orig: 0, paid: 0, rem: 0, symbol: it.currency.symbol };
    t.orig += it.originalAmount; t.paid += it.paidAmount; t.rem += it.remainingAmount;
    totals.set(it.currency.code, t);
  }

  return (
    <div>
      <h2 className={`text-sm font-bold px-3 py-2 rounded-md border-l-4 ${accent} flex items-center gap-2`}>
        {isAR ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} {title}
      </h2>

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm py-3 px-3">{T.none}</p>
      ) : (
        <>
          {/* ── Mobile: stacked cards ─────────────────────────────────────── */}
          <div className="sm:hidden mt-2 space-y-2">
            {items.map(it => {
              const paidOff = it.status === "settled";
              return (
                <div key={it.id} className={`rounded-xl border p-3 ${paidOff ? "border-slate-100 bg-slate-50/50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(it.agreementDate)}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusChip(it.status)}`}>{statusLabel(it.status, T)}</span>
                  </div>
                  <p className={`mt-1 text-sm break-words ${paidOff ? "text-slate-400" : "font-semibold text-slate-800"}`}>
                    {it.description || <span className="text-slate-300">—</span>}
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div>{T.orig}: <span className="text-slate-700">{formatAmount(it.originalAmount, it.currency.symbol)}</span></div>
                      <div>{isAR ? T.recv : T.paid}: <span className="text-slate-700">{formatAmount(it.paidAmount, it.currency.symbol)}</span></div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{T.rem}</div>
                      <div className={`text-base font-bold ${paidOff ? "text-green-500" : remColor}`}>
                        {formatAmount(it.remainingAmount, it.currency.symbol)} <span className="text-[11px] font-medium text-slate-400">{it.currency.code}</span>
                      </div>
                    </div>
                  </div>
                  {it.attachmentUrl && (
                    <button onClick={() => onDoc(it.attachmentUrl!)}
                      className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                      <Paperclip className="h-3 w-3" />{T.viewDoc} {T.doc}
                    </button>
                  )}
                  {it.payments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                      {it.payments.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate">└ {T.payment} · {fmtDate(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {formatAmount(p.amount, p.currency.symbol)}
                            {p.attachmentUrl && (
                              <button onClick={() => onDoc(p.attachmentUrl!)} className="text-blue-500"><Paperclip className="h-3 w-3" /></button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {[...totals.entries()].map(([code, t]) => (
              <div key={code} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold ${isAR ? "bg-blue-50" : "bg-red-50"}`}>
                <span className="text-slate-600">{T.total} · {code}</span>
                <span className={remColor}>{formatAmount(t.rem, t.symbol)}</span>
              </div>
            ))}
          </div>

          {/* ── Desktop: table (Agreed-first) ─────────────────────────────── */}
          <div className="hidden sm:block overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">{T.date}</th>
                  <th className="py-2 pr-2 font-medium">{T.desc}</th>
                  <th className="py-2 pr-2 font-medium">{T.status}</th>
                  <th className="py-2 pr-2 font-medium">{T.ccy}</th>
                  <th className="py-2 pr-2 font-medium text-right">{T.orig}</th>
                  <th className="py-2 pr-2 font-medium text-right">{isAR ? T.recv : T.paid}</th>
                  <th className="py-2 pr-2 font-medium text-right">{T.rem}</th>
                  <th className="py-2 font-medium">{T.doc}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const paidOff = it.status === "settled";
                  return (
                    <Fragment key={it.id}>
                      <tr className={`border-b border-slate-50 ${paidOff ? "text-slate-400" : "text-slate-700"}`}>
                        <td className="py-2 pr-2 whitespace-nowrap text-slate-500">{fmtDate(it.agreementDate)}</td>
                        <td className={`py-2 pr-2 ${paidOff ? "" : "font-semibold text-slate-800"}`}>{it.description || <span className="text-slate-300">—</span>}</td>
                        <td className={`py-2 pr-2 font-medium ${paidOff ? "text-green-600" : it.status === "partial" ? "text-orange-600" : "text-slate-500"}`}>{statusLabel(it.status, T)}</td>
                        <td className="py-2 pr-2 text-slate-500 font-medium">{it.currency.code}</td>
                        <td className="py-2 pr-2 text-right">{formatAmount(it.originalAmount, it.currency.symbol)}</td>
                        <td className="py-2 pr-2 text-right">{formatAmount(it.paidAmount, it.currency.symbol)}</td>
                        <td className={`py-2 pr-2 text-right font-bold ${paidOff ? "text-green-500" : remColor}`}>{formatAmount(it.remainingAmount, it.currency.symbol)}</td>
                        <td className="py-2">
                          {it.attachmentUrl && (
                            <button onClick={() => onDoc(it.attachmentUrl!)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                              <Paperclip className="h-3 w-3" />{T.viewDoc}
                            </button>
                          )}
                        </td>
                      </tr>
                      {it.payments.map(p => (
                        <tr key={p.id} className="text-[11px] text-slate-400 bg-slate-50/60">
                          <td className="py-1.5 pr-2 pl-3" colSpan={3}>└ {T.payment} · {fmtDate(p.date)}{p.note ? ` · ${p.note}` : ""}</td>
                          <td className="py-1.5 pr-2 text-slate-400">{p.currency.code}</td>
                          <td />
                          <td className="py-1.5 pr-2 text-right text-slate-500">{formatAmount(p.amount, p.currency.symbol)}</td>
                          <td />
                          <td className="py-1.5">
                            {p.attachmentUrl && (
                              <button onClick={() => onDoc(p.attachmentUrl!)} className="inline-flex items-center gap-1 text-blue-500 hover:underline">
                                <Paperclip className="h-3 w-3" />{T.viewDoc}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                {[...totals.entries()].map(([code, t]) => (
                  <tr key={code} className={`font-bold border-t-2 ${isAR ? "border-blue-600" : "border-red-600"}`}>
                    <td className="py-2 pr-2" colSpan={3}>{T.total}</td>
                    <td className="py-2 pr-2 text-slate-500">{code}</td>
                    <td className="py-2 pr-2 text-right text-slate-600">{formatAmount(t.orig, t.symbol)}</td>
                    <td className="py-2 pr-2 text-right text-slate-600">{formatAmount(t.paid, t.symbol)}</td>
                    <td className={`py-2 pr-2 text-right ${remColor}`}>{formatAmount(t.rem, t.symbol)}</td>
                    <td />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function statusChip(status: string) {
  return status === "settled" ? "bg-green-50 text-green-600"
    : status === "partial" ? "bg-orange-50 text-orange-600"
    : "bg-slate-100 text-slate-500";
}
