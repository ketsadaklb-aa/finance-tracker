"use client";
import { useEffect, useState } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners, useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragOverEvent, DragEndEvent, UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { Task, TaskStatus, COLUMNS, groupByStatus } from "./types";
import { TaskCard } from "./task-card";

type Cols = Record<TaskStatus, Task[]>;

const findContainer = (cols: Cols, id: UniqueIdentifier): TaskStatus | undefined =>
  (id as string) in cols
    ? (id as TaskStatus)
    : (Object.keys(cols) as TaskStatus[]).find(k => cols[k].some(t => t.id === id));

function SortableCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onClick={() => onOpen(task)} />
    </div>
  );
}

function Column({
  col, items, onOpen, onAdd,
}: {
  col: (typeof COLUMNS)[number]; items: Task[]; onOpen: (t: Task) => void; onAdd: (s: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div className={`flex flex-col rounded-2xl bg-slate-50 border-t-4 ${col.accent} min-h-[120px]`}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${col.dot}`} />
          <span className="text-sm font-semibold text-slate-700">{col.label}</span>
          <span className="text-xs text-slate-400">{items.length}</span>
        </div>
        <button onClick={() => onAdd(col.key)} title="Add task"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div ref={setNodeRef} className={`flex-1 px-2.5 pb-2.5 space-y-2 rounded-b-2xl transition-colors ${isOver ? "bg-slate-100" : ""}`}>
        <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {items.map(t => <SortableCard key={t.id} task={t} onOpen={onOpen} />)}
        </SortableContext>
        {items.length === 0 && <p className="text-xs text-slate-300 text-center py-6">Drop here</p>}
      </div>
    </div>
  );
}

export function Board({
  tasks, onOpen, onAdd, onMove,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onAdd: (s: TaskStatus) => void;
  onMove: (taskId: string, status: TaskStatus, order: number) => void;
}) {
  const [cols, setCols] = useState<Cols>(() => groupByStatus(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // Re-sync from server data whenever it changes and we're not mid-drag.
  useEffect(() => { if (!activeId) setCols(groupByStatus(tasks)); }, [tasks, activeId]);

  const activeTask = activeId ? Object.values(cols).flat().find(t => t.id === activeId) : null;

  function onDragStart(e: DragStartEvent) { setActiveId(e.active.id as string); }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = findContainer(cols, active.id);
    const to = findContainer(cols, over.id);
    if (!from || !to || from === to) return;
    setCols(prev => {
      const fromItems = prev[from];
      const toItems = prev[to];
      const moving = fromItems.find(t => t.id === active.id);
      if (!moving) return prev;
      let overIndex = toItems.findIndex(t => t.id === over.id);
      if (overIndex < 0) overIndex = toItems.length;
      return {
        ...prev,
        [from]: fromItems.filter(t => t.id !== active.id),
        [to]: [...toItems.slice(0, overIndex), { ...moving, status: to }, ...toItems.slice(overIndex)],
      };
    });
  }

  function persist(taskId: string, status: TaskStatus, items: Task[], index: number) {
    const prev = items[index - 1]?.order;
    const next = items[index + 1]?.order;
    let order: number;
    if (prev != null && next != null) order = (prev + next) / 2;
    else if (prev != null) order = prev + 1;
    else if (next != null) order = next - 1;
    else order = 0;
    onMove(taskId, status, order);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const to = over ? findContainer(cols, over.id) : findContainer(cols, active.id);
    if (to) {
      let items = cols[to];
      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex(t => t.id === active.id);
        const newIndex = items.findIndex(t => t.id === over.id);
        if (oldIndex >= 0 && newIndex >= 0) {
          items = arrayMove(items, oldIndex, newIndex);
          setCols(prev => ({ ...prev, [to]: items }));
        }
      }
      const index = items.findIndex(t => t.id === active.id);
      if (index >= 0) persist(active.id as string, to, items, index);
    }
    setActiveId(null);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {COLUMNS.map(col => (
          <Column key={col.key} col={col} items={cols[col.key]} onOpen={onOpen} onAdd={onAdd} />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
