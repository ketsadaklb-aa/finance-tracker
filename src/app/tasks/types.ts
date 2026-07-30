export interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string };
}

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Attachment { id: string; name: string; url: string; type: string }
export interface UserLite { id: string; name: string }

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  checklist: ChecklistItem[] | null;
  attachments: Attachment[] | null;
  archivedAt: string | null;
  assignee: UserLite | null;
  owner: UserLite;
  order: number;
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export const initials = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

export const checklistDone = (c: ChecklistItem[] | null) => (c ?? []).filter(i => i.done).length;

export const COLUMNS: { key: TaskStatus; label: string; accent: string; dot: string }[] = [
  { key: "todo",  label: "To do",       accent: "border-t-slate-300", dot: "bg-slate-400" },
  { key: "doing", label: "In progress", accent: "border-t-blue-400",  dot: "bg-blue-500" },
  { key: "done",  label: "Done",        accent: "border-t-emerald-400", dot: "bg-emerald-500" },
];

export const PRIORITY: Record<TaskPriority, { label: string; dot: string; chip: string }> = {
  low:    { label: "Low",    dot: "bg-slate-400", chip: "bg-slate-100 text-slate-500" },
  medium: { label: "Medium", dot: "bg-amber-400", chip: "bg-amber-50 text-amber-600" },
  high:   { label: "High",   dot: "bg-red-500",   chip: "bg-red-50 text-red-600" },
};

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const cols: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] };
  for (const t of tasks) cols[t.status].push(t);
  for (const k of Object.keys(cols) as TaskStatus[]) cols[k].sort((a, b) => a.order - b.order);
  return cols;
}

// Local date helpers (no timezone surprises for date-only fields)
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dueYmd = (iso: string | null) => (iso ? ymd(new Date(iso)) : null);
