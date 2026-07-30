"use client";
import { Check, CalendarDays, Paperclip, MessageSquare } from "lucide-react";
import { Task, PRIORITY, ymd, dueYmd, initials } from "./types";

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

type Bucket = { key: string; label: string; tone: string; tasks: Task[] };

function bucketize(tasks: Task[]): Bucket[] {
  const today = new Date();
  const t0 = ymd(today);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const t7 = ymd(weekEnd);

  const b: Record<string, Task[]> = { overdue: [], today: [], week: [], later: [], nodate: [], done: [] };
  for (const t of tasks) {
    if (t.status === "done") { b.done.push(t); continue; }
    const d = dueYmd(t.dueDate);
    if (!d) b.nodate.push(t);
    else if (d < t0) b.overdue.push(t);
    else if (d === t0) b.today.push(t);
    else if (d <= t7) b.week.push(t);
    else b.later.push(t);
  }
  const order = (arr: Task[]) => arr.sort((a, z) => (dueYmd(a.dueDate) ?? "9").localeCompare(dueYmd(z.dueDate) ?? "9"));
  return [
    { key: "overdue", label: "Overdue",       tone: "text-red-600",     tasks: order(b.overdue) },
    { key: "today",   label: "Today",         tone: "text-blue-600",    tasks: order(b.today) },
    { key: "week",    label: "This week",     tone: "text-slate-700",   tasks: order(b.week) },
    { key: "later",   label: "Later",         tone: "text-slate-500",   tasks: order(b.later) },
    { key: "nodate",  label: "No due date",   tone: "text-slate-400",   tasks: b.nodate },
    { key: "done",    label: "Done",          tone: "text-emerald-600", tasks: b.done },
  ].filter(x => x.tasks.length > 0);
}

export function Agenda({ tasks, onOpen, onToggleDone }: {
  tasks: Task[]; onOpen: (t: Task) => void; onToggleDone: (t: Task) => void;
}) {
  const buckets = bucketize(tasks);
  if (buckets.length === 0)
    return <p className="text-center text-slate-400 text-sm py-16">Nothing scheduled. Add a task to get started.</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {buckets.map(bk => (
        <div key={bk.key}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`text-sm font-bold ${bk.tone}`}>{bk.label}</h3>
            <span className="text-xs text-slate-400">{bk.tasks.length}</span>
          </div>
          <div className="rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {bk.tasks.map(t => {
              const done = t.status === "done";
              const p = PRIORITY[t.priority];
              return (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 group">
                  <button onClick={() => onToggleDone(t)} title={done ? "Mark not done" : "Mark done"}
                    className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition
                      ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-400"}`}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${p.dot}`} title={p.label} />
                  <button onClick={() => onOpen(t)} className="flex-1 text-left min-w-0">
                    <span className={`text-sm ${done ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</span>
                    <span className="ml-2 inline-flex items-center gap-2 align-middle">
                      {t.attachments?.length ? <span className="text-[11px] text-slate-400 inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{t.attachments.length}</span> : null}
                      {t.comments.length ? <span className="text-[11px] text-slate-400 inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{t.comments.length}</span> : null}
                    </span>
                  </button>
                  {t.dueDate && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <CalendarDays className="h-3 w-3" />{fmtDay(t.dueDate)}{t.dueTime ? ` ${t.dueTime}` : ""}
                    </span>
                  )}
                  {t.assignee && (
                    <span title={t.assignee.name}
                      className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                      {initials(t.assignee.name)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
