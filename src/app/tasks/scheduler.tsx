"use client";
import { useState } from "react";
import { Calendar } from "./calendar";
import { WeekGrid, SchedulePatch } from "./week-grid";
import { Task } from "./types";

export function Scheduler({ tasks, onOpen, onReschedule, onSchedule }: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onReschedule: (taskId: string, date: string | null) => void;
  onSchedule: (taskId: string, patch: SchedulePatch) => void;
}) {
  const [mode, setMode] = useState<"month" | "week" | "day">("week");
  return (
    <div>
      <div className="flex justify-center mb-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {(["month", "week", "day"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 capitalize ${mode === m ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{m}</button>
          ))}
        </div>
      </div>
      {mode === "month"
        ? <Calendar tasks={tasks} onOpen={onOpen} onReschedule={onReschedule} />
        : <WeekGrid mode={mode} tasks={tasks} onOpen={onOpen} onSchedule={onSchedule} />}
    </div>
  );
}
