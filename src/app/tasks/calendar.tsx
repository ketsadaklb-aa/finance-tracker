"use client";
import { useState } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, pointerWithin,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Inbox, X } from "lucide-react";
import { Task, PRIORITY, ymd, dueYmd } from "./types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // make Monday the first column
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

function Chip({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const p = PRIORITY[task.priority];
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => onOpen(task)}
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] cursor-pointer bg-white border border-slate-200 hover:border-slate-300 ${isDragging ? "opacity-40" : ""} ${task.status === "done" ? "line-through text-slate-400" : "text-slate-700"}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.dot}`} />
      <span className="truncate">{task.title}</span>
    </div>
  );
}

function DayCell({ date, inMonth, isToday, tasks, onOpen, onMore }: {
  date: Date; inMonth: boolean; isToday: boolean; tasks: Task[]; onOpen: (t: Task) => void; onMore: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ymd(date) });
  const MAX = 3;
  return (
    <div ref={setNodeRef}
      className={`min-h-[92px] border-b border-r border-slate-100 p-1 flex flex-col gap-1 transition-colors
        ${inMonth ? "bg-white" : "bg-slate-50/60"} ${isOver ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}>
      <span className={`text-[11px] font-medium self-end w-5 h-5 flex items-center justify-center rounded-full
        ${isToday ? "bg-blue-600 text-white" : inMonth ? "text-slate-500" : "text-slate-300"}`}>
        {date.getDate()}
      </span>
      <div className="space-y-1 overflow-hidden">
        {tasks.slice(0, MAX).map(t => <Chip key={t.id} task={t} onOpen={onOpen} />)}
        {tasks.length > MAX && (
          <button onClick={e => { e.stopPropagation(); onMore(); }}
            className="text-[10px] font-medium text-blue-600 hover:underline pl-1">+{tasks.length - MAX} more</button>
        )}
      </div>
    </div>
  );
}

function Tray({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  return (
    <div ref={setNodeRef}
      className={`rounded-2xl border border-dashed p-3 ${isOver ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-center gap-2 mb-2 text-slate-500">
        <Inbox className="h-4 w-4" /><span className="text-sm font-semibold">Unscheduled</span>
        <span className="text-xs text-slate-400">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-slate-400">Drag a task here to clear its date.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">{tasks.map(t => <Chip key={t.id} task={t} onOpen={onOpen} />)}</div>
      )}
    </div>
  );
}

export function Calendar({ tasks, onOpen, onReschedule }: {
  tasks: Task[]; onOpen: (t: Task) => void; onReschedule: (taskId: string, date: string | null) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dayModal, setDayModal] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const days = monthMatrix(cursor.y, cursor.m);
  const todayYmd = ymd(today);
  const byDay = new Map<string, Task[]>();
  const unscheduled: Task[] = [];
  for (const t of tasks) {
    const d = dueYmd(t.dueDate);
    if (!d) { unscheduled.push(t); continue; }
    const arr = byDay.get(d) ?? (byDay.set(d, []), byDay.get(d)!);
    arr.push(t);
  }
  for (const arr of byDay.values())
    arr.sort((a, b) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"));

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const overId = over.id as string;
    onReschedule(active.id as string, overId === "unscheduled" ? null : overId);
  }

  function shift(delta: number) {
    setCursor(c => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
      onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-800">{monthLabel(cursor.y, cursor.m)}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600">Today</button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {WEEKDAYS.map(d => <div key={d} className="text-[11px] font-semibold text-slate-400 text-center py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => (
            <DayCell key={i} date={d} inMonth={d.getMonth() === cursor.m} isToday={ymd(d) === todayYmd}
              tasks={byDay.get(ymd(d)) ?? []} onOpen={onOpen} onMore={() => setDayModal(ymd(d))} />
          ))}
        </div>
      </div>

      <div className="mt-4"><Tray tasks={unscheduled} onOpen={onOpen} /></div>

      {dayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDayModal(null)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">
                {new Date(dayModal + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "long" })}
              </h3>
              <button onClick={() => setDayModal(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {(byDay.get(dayModal) ?? []).map(t => (
                <button key={t.id} onClick={() => { setDayModal(null); onOpen(t); }}
                  className="w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY[t.priority].dot}`} />
                  <span className={`text-sm truncate ${t.status === "done" ? "line-through text-slate-400" : "text-slate-700"}`}>{t.title}</span>
                  {t.dueTime && <span className="text-xs text-slate-400 ml-auto shrink-0">{t.dueTime}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <DragOverlay>{activeTask ? (
        <div className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] bg-white border border-blue-300 shadow-lg text-slate-700">
          <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY[activeTask.priority].dot}`} />
          <span className="truncate max-w-[140px]">{activeTask.title}</span>
        </div>
      ) : null}</DragOverlay>
    </DndContext>
  );
}
