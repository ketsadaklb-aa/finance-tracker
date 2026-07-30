export interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string };
}

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Attachment { id: string; name: string; url: string; type: string }
export interface UserLite { id: string; name: string }

export type TaskStatus = string; // a column id (customizable per user)
export type TaskPriority = "low" | "medium" | "high";

export interface BoardColumn { id: string; label: string; row?: number }

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  durationMin: number | null;
  checklist: ChecklistItem[] | null;
  attachments: Attachment[] | null;
  tags: string[] | null;
  archivedAt: string | null;
  assignees: { user: UserLite }[];
  owner: UserLite;
  order: number;
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export const initials = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

export const checklistDone = (c: ChecklistItem[] | null) => (c ?? []).filter(i => i.done).length;

// Time-of-day helpers for the week/day grid
export const hmToMin = (t: string | null | undefined): number | null => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
export const minToHm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: "todo",     label: "To do / Braindump", row: 1 },
  { id: "doing",    label: "In progress",       row: 1 },
  { id: "delegate", label: "Delegate",          row: 2 },
  { id: "later",    label: "Later",             row: 2 },
  { id: "done",     label: "Done",              row: 1 },
];

const COLUMN_PALETTE = [
  { accent: "border-t-slate-300",  dot: "bg-slate-400" },
  { accent: "border-t-blue-400",   dot: "bg-blue-500" },
  { accent: "border-t-violet-400", dot: "bg-violet-500" },
  { accent: "border-t-amber-400",  dot: "bg-amber-500" },
  { accent: "border-t-rose-400",   dot: "bg-rose-500" },
  { accent: "border-t-cyan-400",   dot: "bg-cyan-500" },
];
// "done" always reads as completed (green); others cycle a palette by position.
export function columnStyle(id: string, index: number) {
  if (id === "done") return { accent: "border-t-emerald-400", dot: "bg-emerald-500" };
  return COLUMN_PALETTE[index % COLUMN_PALETTE.length];
}

export const PRIORITY: Record<TaskPriority, { label: string; dot: string; chip: string }> = {
  low:    { label: "Low",    dot: "bg-slate-400", chip: "bg-slate-100 text-slate-500" },
  medium: { label: "Medium", dot: "bg-amber-400", chip: "bg-amber-50 text-amber-600" },
  high:   { label: "High",   dot: "bg-red-500",   chip: "bg-red-50 text-red-600" },
};

export function groupByColumns(tasks: Task[], columns: BoardColumn[]): Record<string, Task[]> {
  const cols: Record<string, Task[]> = {};
  columns.forEach(c => { cols[c.id] = []; });
  const firstId = columns[0]?.id;
  for (const t of tasks) {
    if (cols[t.status]) cols[t.status].push(t);
    else if (firstId) cols[firstId].push(t); // status with no matching column → first column
  }
  for (const k of Object.keys(cols)) cols[k].sort((a, b) => a.order - b.order);
  return cols;
}

// Local date helpers (no timezone surprises for date-only fields)
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dueYmd = (iso: string | null) => (iso ? ymd(new Date(iso)) : null);
