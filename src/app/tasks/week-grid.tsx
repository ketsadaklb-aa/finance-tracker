"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Task, PRIORITY, ymd, dueYmd, hmToMin, minToHm } from "./types";

const DAY_START = 6 * 60;      // 06:00
const DAY_END = 24 * 60;       // 24:00
const HOUR_H = 44;             // px per hour
const PXM = HOUR_H / 60;       // px per minute
const SLOT = 30;               // snap minutes
const GRID_H = (DAY_END - DAY_START) * PXM;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface SchedulePatch { dueDate?: string | null; dueTime?: string | null; durationMin?: number | null }

type Drag =
  | { kind: "move"; task: Task; grab: number; duration: number }
  | { kind: "resize"; task: Task; startMin: number }
  | { kind: "place"; task: Task; duration: number };
type Preview = { taskId: string; dayIndex: number; startMin: number; durationMin: number };

function weekDays(cursor: Date, count: 1 | 7): Date[] {
  if (count === 1) return [new Date(cursor)];
  const offset = (cursor.getDay() + 6) % 7; // Monday-start
  const start = new Date(cursor); start.setDate(cursor.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

export function WeekGrid({ mode, tasks, onOpen, onSchedule }: {
  mode: "week" | "day";
  tasks: Task[];
  onOpen: (t: Task) => void;
  onSchedule: (taskId: string, patch: SchedulePatch) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date());
  const days = weekDays(cursor, mode === "day" ? 1 : 7);
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const movedRef = useRef(false);
  const backlogRef = useRef<HTMLDivElement>(null);
  const [overBacklog, setOverBacklog] = useState(false);
  const overBacklogRef = useRef(false);

  const setPrev = (p: Preview | null) => { previewRef.current = p; setPreview(p); };
  const overBacklogArea = (e: PointerEvent) => {
    const r = backlogRef.current?.getBoundingClientRect();
    return !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };

  // Locate the day column + snapped minute under the pointer.
  function locate(e: PointerEvent) {
    const rect = gridRef.current!.getBoundingClientRect();
    const colW = rect.width / days.length;
    const dayIndex = clamp(Math.floor((e.clientX - rect.left) / colW), 0, days.length - 1);
    const rawMin = DAY_START + (e.clientY - rect.top) / PXM;
    const min = clamp(Math.round(rawMin / SLOT) * SLOT, DAY_START, DAY_END);
    return { dayIndex, min };
  }

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      movedRef.current = true;
      const ob = drag.kind !== "resize" && overBacklogArea(e);
      overBacklogRef.current = ob; setOverBacklog(ob);
      const { dayIndex, min } = locate(e);
      if (drag.kind === "resize") {
        const dur = clamp(Math.round((min - drag.startMin) / SLOT) * SLOT, SLOT, DAY_END - drag.startMin);
        setPrev({ taskId: drag.task.id, dayIndex: days.findIndex(d => ymd(d) === dueYmd(drag.task.dueDate)), startMin: drag.startMin, durationMin: dur });
      } else {
        const grab = drag.kind === "move" ? drag.grab : 0;
        const start = clamp(Math.round((min - grab) / SLOT) * SLOT, DAY_START, DAY_END - drag.duration);
        setPrev({ taskId: drag.task.id, dayIndex, startMin: start, durationMin: drag.duration });
      }
    };
    const onUp = () => {
      const p = previewRef.current;
      if (!movedRef.current || !p) onOpen(drag.task);
      else if (overBacklogRef.current && drag.kind !== "resize") onSchedule(drag.task.id, { dueDate: null, dueTime: null, durationMin: null });
      else if (drag.kind === "resize") onSchedule(drag.task.id, { durationMin: p.durationMin });
      else onSchedule(drag.task.id, { dueDate: ymd(days[p.dayIndex]), dueTime: minToHm(p.startMin), durationMin: p.durationMin });
      setDrag(null); setPrev(null); overBacklogRef.current = false; setOverBacklog(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [drag]); // eslint-disable-line react-hooks/exhaustive-deps

  function startMove(e: React.PointerEvent, task: Task) {
    e.preventDefault(); movedRef.current = false;
    const startMin = hmToMin(task.dueTime) ?? DAY_START;
    const { min } = locate(e.nativeEvent);
    setDrag({ kind: "move", task, grab: min - startMin, duration: task.durationMin ?? 60 });
  }
  function startResize(e: React.PointerEvent, task: Task) {
    e.preventDefault(); e.stopPropagation(); movedRef.current = false;
    setDrag({ kind: "resize", task, startMin: hmToMin(task.dueTime) ?? DAY_START });
  }
  function startPlace(e: React.PointerEvent, task: Task) {
    e.preventDefault(); movedRef.current = false;
    setDrag({ kind: "place", task, duration: task.durationMin ?? 60 });
  }

  function shift(delta: number) {
    setCursor(c => { const d = new Date(c); d.setDate(c.getDate() + delta * (mode === "day" ? 1 : 7)); return d; });
  }

  const timed = (d: Date) => tasks.filter(t => dueYmd(t.dueDate) === ymd(d) && t.dueTime);
  const allDay = (d: Date) => tasks.filter(t => dueYmd(t.dueDate) === ymd(d) && !t.dueTime);
  const unscheduled = tasks.filter(t => !t.dueDate && t.status !== "done");
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);
  const label = mode === "day"
    ? cursor.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : `${days[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-800">{label}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCursor(new Date())} className="text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600">Today</button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Unscheduled backlog — drag chips onto the grid to schedule, or drag blocks back here to unschedule */}
      <div ref={backlogRef}
        className={`mb-3 rounded-xl border border-dashed p-2 transition-colors ${overBacklog ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 bg-slate-50"}`}>
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <Inbox className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Unscheduled</span>
          <span className="text-[11px] text-slate-400">{unscheduled.length}</span>
          <span className="text-[11px] text-slate-400 ml-auto hidden sm:inline">
            {overBacklog ? "release to unschedule" : "drag onto the grid to schedule · drag a block here to unschedule"}
          </span>
        </div>
        {unscheduled.length === 0 ? (
          <p className="text-[11px] text-slate-400 px-1 pb-0.5">No unscheduled tasks.</p>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {unscheduled.map(t => (
              <div key={t.id} onPointerDown={e => startPlace(e, t)}
                className={`shrink-0 flex items-center gap-1 text-[11px] rounded-md px-2 py-1 cursor-grab active:cursor-grabbing border bg-white border-slate-200 text-slate-700 max-w-[170px] ${drag?.task.id === t.id ? "opacity-40" : ""}`}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY[t.priority].dot}`} />
                <span className="truncate">{t.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        {/* Day headers */}
        <div className="flex border-b border-slate-100 bg-slate-50">
          <div className="w-12 shrink-0" />
          {days.map((d, i) => {
            const isToday = ymd(d) === ymd(today);
            return (
              <div key={i} className="flex-1 text-center py-2 border-l border-slate-100">
                <div className="text-[11px] text-slate-400">{d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                <div className={`text-sm font-semibold ${isToday ? "text-blue-600" : "text-slate-600"}`}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* All-day (untimed) strip — drag a chip down into the grid to time it */}
        <div className="flex border-b border-slate-100 bg-white min-h-[34px]">
          <div className="w-12 shrink-0 text-[10px] text-slate-400 flex items-center justify-center">all-day</div>
          {days.map((d, i) => (
            <div key={i} className="flex-1 border-l border-slate-100 p-1 space-y-1">
              {allDay(d).map(t => (
                <div key={t.id} onPointerDown={e => startPlace(e, t)}
                  className={`text-[11px] rounded px-1.5 py-0.5 cursor-grab active:cursor-grabbing border ${t.status === "done" ? "line-through text-slate-400 bg-slate-50" : "bg-white text-slate-700 border-slate-200"}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle ${PRIORITY[t.priority].dot}`} />
                  <span className="align-middle">{t.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
          <div className="flex" style={{ height: GRID_H }}>
            {/* hour gutter */}
            <div className="w-12 shrink-0 relative">
              {hours.map(h => (
                <div key={h} className="absolute right-1 text-[10px] text-slate-400 -translate-y-1/2" style={{ top: (h * 60 - DAY_START) * PXM }}>
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {/* day columns */}
            <div ref={gridRef} className="flex-1 flex relative">
              {days.map((d, dayIdx) => {
                const blocks = timed(d).filter(t => !(preview && preview.taskId === t.id));
                const ghost = preview && preview.dayIndex === dayIdx ? preview : null;
                return (
                  <div key={dayIdx} className="flex-1 relative border-l border-slate-100"
                    style={{ backgroundImage: `repeating-linear-gradient(#f1f5f9 0 1px, transparent 1px ${HOUR_H}px)` }}>
                    {blocks.map(t => (
                      <Block key={t.id} task={t}
                        start={hmToMin(t.dueTime) ?? DAY_START} duration={t.durationMin ?? 60}
                        onMove={e => startMove(e, t)} onResize={e => startResize(e, t)} />
                    ))}
                    {ghost && !overBacklog && (() => {
                      const t = tasks.find(x => x.id === ghost.taskId);
                      return t ? <Block task={t} start={ghost.startMin} duration={ghost.durationMin} preview /> : null;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">Drag an all-day chip into the grid to set a time · drag a block to move it · drag its bottom edge to change duration.</p>
    </div>
  );
}

function Block({ task, start, duration, onMove, onResize, preview }: {
  task: Task; start: number; duration: number;
  onMove?: (e: React.PointerEvent) => void; onResize?: (e: React.PointerEvent) => void; preview?: boolean;
}) {
  const p = PRIORITY[task.priority];
  const top = (start - DAY_START) * PXM;
  const height = Math.max(duration * PXM, 20);
  const done = task.status === "done";
  return (
    <div
      onPointerDown={onMove}
      className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 overflow-hidden border text-[11px] leading-tight
        ${preview ? "opacity-80 ring-2 ring-blue-400 z-20" : "z-10"} ${onMove ? "cursor-grab active:cursor-grabbing" : ""}
        ${done ? "bg-slate-100 border-slate-200 text-slate-400" : "bg-blue-50 border-blue-200 text-slate-700"}`}
      style={{ top, height }}
    >
      <div className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.dot}`} />
        <span className="font-medium truncate">{minToHm(start)} {task.title}</span>
      </div>
      {onResize && (
        <div onPointerDown={onResize}
          className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize flex items-end justify-center">
          <div className="w-6 h-1 rounded-full bg-slate-300 mb-0.5" />
        </div>
      )}
    </div>
  );
}
