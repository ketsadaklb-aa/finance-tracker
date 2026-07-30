"use client";
import { CalendarDays, MessageSquare, CheckSquare, Paperclip, Tag } from "lucide-react";
import { Task, PRIORITY, dueYmd, ymd, initials, checklistDone } from "./types";

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export function TaskCard({ task, onClick, dragging }: { task: Task; onClick?: () => void; dragging?: boolean }) {
  const p = PRIORITY[task.priority];
  const overdue = task.status !== "done" && task.dueDate && dueYmd(task.dueDate)! < ymd(new Date());
  const clDone = checklistDone(task.checklist);
  const clTotal = task.checklist?.length ?? 0;
  const attachN = task.attachments?.length ?? 0;
  const hasMeta = task.dueDate || task.comments.length > 0 || clTotal > 0 || attachN > 0;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-white p-3 shadow-sm select-none cursor-pointer transition
        ${dragging ? "border-blue-300 shadow-lg rotate-[1deg]" : "border-slate-200 hover:border-slate-300"}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${p.dot}`} title={p.label} />
        <p className={`text-sm font-medium leading-snug flex-1 ${task.status === "done" ? "text-slate-400 line-through" : "text-slate-800"}`}>
          {task.title}
        </p>
        {task.assignee && (
          <span title={task.assignee.name}
            className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
            {initials(task.assignee.name)}
          </span>
        )}
      </div>
      {task.description && (
        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 pl-4">{task.description}</p>
      )}
      {task.tags && task.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-4">
          {task.tags.slice(0, 4).map(tag => (
            <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">
              <Tag className="h-2.5 w-2.5" />{tag}
            </span>
          ))}
        </div>
      )}
      {hasMeta && (
        <div className="mt-2 flex items-center gap-2 flex-wrap pl-4">
          {task.dueDate && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md font-medium
              ${overdue ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
              <CalendarDays className="h-3 w-3" />{fmtDay(task.dueDate)}{task.dueTime ? ` ${task.dueTime}` : ""}
            </span>
          )}
          {clTotal > 0 && (
            <span className={`inline-flex items-center gap-1 text-[11px] ${clDone === clTotal ? "text-emerald-600" : "text-slate-400"}`}>
              <CheckSquare className="h-3 w-3" />{clDone}/{clTotal}
            </span>
          )}
          {attachN > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Paperclip className="h-3 w-3" />{attachN}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <MessageSquare className="h-3 w-3" />{task.comments.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
