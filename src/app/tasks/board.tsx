"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners, pointerWithin, useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragOverEvent, DragEndEvent, UniqueIdentifier, CollisionDetection } from "@dnd-kit/core";

// Pointer-first: drop into the column the cursor is over (works across rows).
// Falls back to closest-corners when the pointer is in a gap.
const boardCollision: CollisionDetection = args => {
  const pointer = pointerWithin(args);
  return pointer.length > 0 ? pointer : closestCorners(args);
};
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Plus } from "lucide-react";
import { Task, TaskStatus, BoardColumn, columnStyle, groupByColumns } from "./types";
import { TaskCard } from "./task-card";

type Cols = Record<string, Task[]>;

const findContainer = (cols: Cols, id: UniqueIdentifier): string | undefined =>
  (id as string) in cols
    ? (id as string)
    : Object.keys(cols).find(k => cols[k].some(t => t.id === id));

function SortableCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      data-card
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onClick={() => onOpen(task)} />
    </div>
  );
}

function Column({
  col, index, items, onOpen, onAdd,
}: {
  col: BoardColumn; index: number; items: Task[]; onOpen: (t: Task) => void; onAdd: (s: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const style = columnStyle(col.id, index);

  // Long columns scroll inside a capped height so rows below stay in view.
  // Track overflow to show edge fades and a "N more" jump hint.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false, hidden: 0 });
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 4;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    // Count cards whose top edge is below the visible area
    const viewBottom = el.getBoundingClientRect().bottom;
    const hidden = bottom
      ? Array.from(el.querySelectorAll("[data-card]")).filter(c => c.getBoundingClientRect().top > viewBottom - 8).length
      : 0;
    setEdges(prev => (prev.top === top && prev.bottom === bottom && prev.hidden === hidden ? prev : { top, bottom, hidden }));
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach(c => ro.observe(c));
    return () => ro.disconnect();
  }, [items.length, measure]);
  const setRefs = useCallback((el: HTMLDivElement | null) => { scrollRef.current = el; setNodeRef(el); }, [setNodeRef]);
  return (
    <div className="relative flex flex-col rounded-2xl bg-slate-50/70 border border-slate-200/70 min-h-[120px] w-full">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
          <span className="text-sm font-semibold text-slate-700 truncate">{col.label}</span>
          <span className="text-xs text-slate-400 shrink-0">{items.length}</span>
        </div>
        <button onClick={() => onAdd(col.id)} title="Add task"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 shrink-0">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={setRefs}
        onScroll={measure}
        className={`flex-1 max-h-[min(62vh,34rem)] overflow-y-auto overscroll-contain px-2.5 pb-2.5 space-y-2 rounded-b-2xl transition-colors [scrollbar-width:thin] ${isOver ? "bg-slate-100" : ""}`}
        style={{
          maskImage: `linear-gradient(to bottom, ${edges.top ? "transparent 0, black 24px" : "black 0"}, ${edges.bottom ? "black calc(100% - 40px), transparent 100%" : "black 100%"})`,
          WebkitMaskImage: `linear-gradient(to bottom, ${edges.top ? "transparent 0, black 24px" : "black 0"}, ${edges.bottom ? "black calc(100% - 40px), transparent 100%" : "black 100%"})`,
        }}
      >
        <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {items.map(t => <SortableCard key={t.id} task={t} onOpen={onOpen} />)}
        </SortableContext>
        {items.length === 0 && <p className="text-xs text-slate-300 text-center py-6">Drop here</p>}
      </div>
      {edges.bottom && edges.hidden > 0 && (
        <button
          onClick={() => scrollRef.current?.scrollBy({ top: scrollRef.current.clientHeight * 0.8, behavior: "smooth" })}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80 hover:text-slate-800 transition-colors animate-fade-in"
        >
          {edges.hidden} more <ChevronDown className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function Board({
  tasks, columns, onOpen, onAdd, onMove,
}: {
  tasks: Task[];
  columns: BoardColumn[];
  onOpen: (t: Task) => void;
  onAdd: (s: TaskStatus) => void;
  onMove: (taskId: string, status: TaskStatus, order: number) => void;
}) {
  const [cols, setCols] = useState<Cols>(() => groupByColumns(tasks, columns));
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  useEffect(() => { if (!activeId) setCols(groupByColumns(tasks, columns)); }, [tasks, columns, activeId]);

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
    <DndContext sensors={sensors} collisionDetection={boardCollision}
      onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="space-y-3">
        {[...new Set(columns.map(c => c.row ?? 1))].sort((a, b) => a - b).map(rowNum => (
          <div key={rowNum} className="flex gap-3 items-start">
            {columns.map((col, i) => (col.row ?? 1) === rowNum ? (
              <div key={col.id} className="flex-1 min-w-0">
                <Column col={col} index={i} items={cols[col.id] ?? []} onOpen={onOpen} onAdd={onAdd} />
              </div>
            ) : null)}
          </div>
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
