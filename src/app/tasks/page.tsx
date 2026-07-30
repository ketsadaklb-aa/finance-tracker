"use client";

import { useEffect, useState } from "react";
import {
  Plus, LayoutGrid, CalendarDays, ListChecks, Trash2, MessageSquare, Loader2,
  Bell, Search, Archive, Paperclip, FileText, X, Check, Upload, Columns3, ChevronUp, ChevronDown, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Task, TaskStatus, TaskPriority, ChecklistItem, Attachment, UserLite, BoardColumn,
  DEFAULT_COLUMNS, PRIORITY, ymd, initials,
} from "./types";
import { Board } from "./board";
import { Scheduler } from "./scheduler";
import type { SchedulePatch } from "./week-grid";
import { Agenda } from "./agenda";
import { useReminders, requestNotificationPermission } from "./use-reminders";

const UNASSIGNED = "unassigned";
const emptyForm = (status: TaskStatus = "todo") => ({
  title: "", description: "", priority: "medium" as TaskPriority, status,
  dueDate: "", dueTime: "", assigneeIds: [] as string[],
});
const uid = () => (crypto?.randomUUID?.() ?? `id-${Math.round(performance.now() * 1000)}`);

export default function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>(DEFAULT_COLUMNS);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "calendar" | "agenda">("board");

  // Manage-columns dialog
  const [colsOpen, setColsOpen] = useState(false);
  const [draftCols, setDraftCols] = useState<BoardColumn[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [remindersOn, setRemindersOn] = useState(false);

  // Editor
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newTag, setNewTag] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<Attachment | null>(null);

  const editingTask = editingId ? tasks.find(t => t.id === editingId) ?? null : null;

  useEffect(() => { load(); loadUsers(); loadColumns(); }, []);
  useReminders(tasks, remindersOn);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/tasks");
    if (r.ok) setTasks(await r.json());
    setLoading(false);
  }
  async function loadUsers() {
    const r = await fetch("/api/users");
    if (r.ok) setUsers(await r.json());
  }
  async function loadColumns() {
    const r = await fetch("/api/tasks/columns");
    if (r.ok) setColumns(await r.json());
  }

  // ── Manage columns ──────────────────────────────────────────────────────────
  function openColumns() { setDraftCols(columns.map(c => ({ ...c }))); setColsOpen(true); }
  const setColLabel = (id: string, label: string) => setDraftCols(cs => cs.map(c => c.id === id ? { ...c, label } : c));
  const setColRow = (id: string, row: number) => setDraftCols(cs => cs.map(c => c.id === id ? { ...c, row } : c));
  const addColumn = () => setDraftCols(cs => [...cs, { id: uid(), label: "New column", row: 1 }]);
  const removeColumn = (id: string) => setDraftCols(cs => cs.filter(c => c.id !== id));
  const moveColumn = (id: string, dir: -1 | 1) => setDraftCols(cs => {
    const i = cs.findIndex(c => c.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= cs.length) return cs;
    const next = [...cs]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  async function saveColumns() {
    const clean = draftCols.map(c => ({ id: c.id, label: c.label.trim() || "Untitled", row: c.row ?? 1 }));
    if (!clean.some(c => c.id === "done")) clean.push({ id: "done", label: "Done", row: 1 });
    // Reassign tasks whose column was removed → first column
    const removed = columns.filter(c => !clean.some(d => d.id === c.id)).map(c => c.id);
    const firstId = clean[0]?.id;
    if (removed.length && firstId) {
      const affected = tasks.filter(t => removed.includes(t.status));
      setTasks(prev => prev.map(t => removed.includes(t.status) ? { ...t, status: firstId } : t));
      await Promise.all(affected.map(t =>
        fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: firstId }) })));
    }
    const r = await fetch("/api/tasks/columns", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columns: clean }) });
    if (!r.ok) { toast("Couldn't save columns", "error"); return; }
    setColumns(await r.json());
    setColsOpen(false);
    toast("Columns updated");
  }

  // ── Editor open/close ───────────────────────────────────────────────────────
  function openNew(status?: TaskStatus) {
    const st = status ?? columns[0]?.id ?? "todo";
    setEditingId(null); setForm(emptyForm(st));
    setChecklist([]); setAttachments([]); setTags([]); setNewItem(""); setNewTag(""); setComment(""); setOpen(true);
  }
  function openEdit(t: Task) {
    setEditingId(t.id);
    setForm({
      title: t.title, description: t.description ?? "", priority: t.priority, status: t.status,
      dueDate: t.dueDate ? ymd(new Date(t.dueDate)) : "", dueTime: t.dueTime ?? "", assigneeIds: t.assignees.map(a => a.user.id),
    });
    setChecklist(t.checklist ?? []); setAttachments(t.attachments ?? []); setTags(t.tags ?? []);
    setNewItem(""); setNewTag(""); setComment(""); setOpen(true);
  }

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag) setTags(ts => ts.some(x => x.toLowerCase() === tag.toLowerCase()) ? ts : [...ts, tag]);
    setNewTag("");
  };
  const removeTag = (tag: string) => setTags(ts => ts.filter(t => t !== tag));

  async function save() {
    if (!form.title.trim()) { toast("Title is required", "error"); return; }
    // Include a tag still typed in the box (user may not have pressed Enter)
    const pending = newTag.trim();
    const finalTags = pending && !tags.some(x => x.toLowerCase() === pending.toLowerCase()) ? [...tags, pending] : tags;
    setTags(finalTags); setNewTag("");
    setSaving(true);
    const payload = {
      title: form.title.trim(), description: form.description.trim() || null,
      priority: form.priority, status: form.status,
      dueDate: form.dueDate || null, dueTime: form.dueDate && form.dueTime ? form.dueTime : null,
      assigneeIds: form.assigneeIds, checklist, attachments, tags: finalTags,
    };
    const r = editingId
      ? await fetch(`/api/tasks/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!r.ok) { toast("Save failed", "error"); return; }
    const saved: Task = await r.json();
    setTasks(prev => editingId ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved]);
    toast(editingId ? "Task updated" : "Task created");
    setOpen(false);
  }

  async function remove(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    setOpen(false);
    const r = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!r.ok) { toast("Delete failed", "error"); load(); } else toast("Task deleted");
  }

  // ── Drag persistence ────────────────────────────────────────────────────────
  async function move(taskId: string, status: TaskStatus, order: number) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, order } : t));
    const r = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, order }) });
    if (!r.ok) { toast("Move failed", "error"); load(); }
  }
  async function reschedule(taskId: string, date: string | null) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, dueDate: date ? `${date}T12:00:00` : null } : t));
    const r = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueDate: date }) });
    if (!r.ok) { toast("Reschedule failed", "error"); load(); }
  }
  // Week/Day grid: place into a time slot / move / resize duration
  async function schedule(taskId: string, patch: SchedulePatch) {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const next = { ...t };
      if (patch.dueDate !== undefined) next.dueDate = patch.dueDate ? `${patch.dueDate}T12:00:00` : null;
      if (patch.dueTime !== undefined) next.dueTime = patch.dueTime;
      if (patch.durationMin !== undefined) next.durationMin = patch.durationMin;
      return next;
    }));
    const r = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!r.ok) { toast("Schedule failed", "error"); load(); }
  }
  async function toggleDone(t: Task) {
    const status: TaskStatus = t.status === "done" ? "todo" : "done";
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status } : x));
    await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  }

  async function addComment() {
    if (!editingId || !comment.trim()) return;
    const body = comment.trim(); setComment("");
    const r = await fetch(`/api/tasks/${editingId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    if (!r.ok) { toast("Couldn't add comment", "error"); return; }
    const c = await r.json();
    setTasks(prev => prev.map(t => t.id === editingId ? { ...t, comments: [...t.comments, c] } : t));
  }

  async function archiveDone() {
    const r = await fetch("/api/tasks/archive-done", { method: "POST" });
    if (!r.ok) { toast("Failed to clear", "error"); return; }
    const { archived } = await r.json();
    setTasks(prev => prev.filter(t => t.status !== "done"));
    toast(archived ? `Archived ${archived} done task${archived > 1 ? "s" : ""}` : "Nothing to clear");
  }

  async function enableReminders() {
    const ok = await requestNotificationPermission();
    setRemindersOn(ok);
    toast(ok ? "Reminders on — you'll be notified of due tasks" : "Notifications blocked in browser", ok ? "success" : "error");
  }

  // ── Checklist + attachments (editor-local until save) ────────────────────────
  const addItem = () => { if (newItem.trim()) { setChecklist(c => [...c, { id: uid(), text: newItem.trim(), done: false }]); setNewItem(""); } };
  const toggleItem = (id: string) => setChecklist(c => c.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const removeItem = (id: string) => setChecklist(c => c.filter(i => i.id !== id));

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (r.ok) { const { url } = await r.json(); setAttachments(a => [...a, { id: uid(), name: file.name, url, type: file.type }]); }
      else toast(`Couldn't upload ${file.name}`, "error");
    }
    setUploading(false);
  }
  const removeAttachment = (id: string) => setAttachments(a => a.filter(x => x.id !== id));

  // ── Derived ─────────────────────────────────────────────────────────────────
  const allTags = [...new Set(tasks.flatMap(t => t.tags ?? []))].sort((a, b) => a.localeCompare(b));
  const filtered = tasks.filter(t => {
    if (search && !`${t.title} ${t.description ?? ""} ${(t.tags ?? []).join(" ")}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (assigneeFilter === UNASSIGNED && t.assignees.length > 0) return false;
    if (assigneeFilter !== "all" && assigneeFilter !== UNASSIGNED && !t.assignees.some(a => a.user.id === assigneeFilter)) return false;
    if (tagFilter !== "all" && !(t.tags ?? []).includes(tagFilter)) return false;
    return true;
  });
  const doneChecklist = checklist.filter(i => i.done).length;

  const VIEWS = [
    { key: "board", label: "Board", icon: LayoutGrid },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
    { key: "agenda", label: "Agenda", icon: ListChecks },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tasks</h1>
          <p className="text-sm text-slate-400">Plan work, attach documents, and drag to reschedule.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={enableReminders} title="Enable due-date reminders"
            className={`p-2 rounded-xl border ${remindersOn ? "border-blue-200 text-blue-600 bg-blue-50" : "border-slate-200 text-slate-400 hover:text-slate-600"}`}>
            <Bell className="h-4 w-4" />
          </button>
          <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1.5" /> New task</Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${view === v.key ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              <v.icon className="h-4 w-4" /> {v.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-44" />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {(Object.keys(PRIORITY) as TaskPriority[]).map(p => <SelectItem key={p} value={p}>{PRIORITY[p].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <button onClick={openColumns} title="Manage board columns"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-2 py-2 ml-auto">
          <Columns3 className="h-4 w-4" /> Columns
        </button>
        <button onClick={archiveDone} title="Archive done tasks"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-2 py-2">
          <Archive className="h-4 w-4" /> Clear done
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
      ) : view === "board" ? (
        <Board tasks={filtered} columns={columns} onOpen={openEdit} onAdd={openNew} onMove={move} />
      ) : view === "calendar" ? (
        <Scheduler tasks={filtered} onOpen={openEdit} onReschedule={reschedule} onSchedule={schedule} />
      ) : (
        <Agenda tasks={filtered} onOpen={openEdit} onToggleDone={toggleDone} />
      )}

      {/* Editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input autoFocus placeholder="What needs doing?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Details, links…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as TaskStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as TaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(PRIORITY) as TaskPriority[]).map(p => <SelectItem key={p} value={p}>{PRIORITY[p].label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" value={form.dueTime} disabled={!form.dueDate} onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assignees <span className="text-slate-400 font-normal">(pick one or more)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {users.length === 0 && <span className="text-xs text-slate-400">No teammates to assign.</span>}
                {users.map(u => {
                  const on = form.assigneeIds.includes(u.id);
                  return (
                    <button key={u.id} type="button"
                      onClick={() => setForm(f => ({ ...f, assigneeIds: on ? f.assigneeIds.filter(id => id !== u.id) : [...f.assigneeIds, u.id] }))}
                      className={`inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-xs font-medium border transition-colors ${on ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold ${on ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"}`}>{initials(u.name)}</span>
                      {u.name}
                      {on && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Tags <span className="text-slate-400 font-normal">(company, project…)</span></Label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-md px-2 py-1">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-800"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input list="task-tag-suggestions" value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(newTag); } }}
                  onBlur={() => { if (newTag.trim()) addTag(newTag); }}
                  placeholder="Type a company or project, press Enter…" />
                <Button type="button" variant="outline" onClick={() => addTag(newTag)} disabled={!newTag.trim()}>Add</Button>
              </div>
              <datalist id="task-tag-suggestions">
                {allTags.filter(t => !tags.some(x => x.toLowerCase() === t.toLowerCase())).map(t => <option key={t} value={t} />)}
              </datalist>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Checklist {checklist.length > 0 && <span className="text-slate-400 font-normal">{doneChecklist}/{checklist.length}</span>}</Label>
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleItem(item.id)}
                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${item.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent"}`}>
                    <Check className="h-3 w-3" />
                  </button>
                  <input value={item.text} onChange={e => setChecklist(c => c.map(i => i.id === item.id ? { ...i, text: e.target.value } : i))}
                    className={`flex-1 text-sm bg-transparent outline-none border-b border-transparent focus:border-slate-200 ${item.done ? "line-through text-slate-400" : "text-slate-700"}`} />
                  <button type="button" onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder="Add a subtask…" value={newItem} onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
                <Button type="button" variant="outline" onClick={addItem} disabled={!newItem.trim()}>Add</Button>
              </div>
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Documents</Label>
              {attachments.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                  <button type="button" onClick={() => setViewer(a)} className="text-blue-600 hover:underline truncate flex-1 text-left">{a.name}</button>
                  <button type="button" onClick={() => removeAttachment(a.id)} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                {uploading ? <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" /> : <Upload className="h-4 w-4 text-slate-400 shrink-0" />}
                <span className="text-sm text-slate-500">{uploading ? "Uploading…" : "Attach JPG, PNG, or PDF"}</span>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleUpload} />
              </label>
            </div>

            {/* Comments (edit mode only) */}
            {editingTask && (
              <div className="space-y-2 pt-1">
                <Label className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Comments</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {editingTask.comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
                  {editingTask.comments.map(c => (
                    <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">{c.author.name}</span>
                        <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap mt-0.5">{c.body}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add a comment…" value={comment} onChange={e => setComment(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addComment(); } }} />
                  <Button type="button" variant="outline" onClick={addComment} disabled={!comment.trim()}>Post</Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
            {editingId ? (
              <Button type="button" variant="outline" onClick={() => remove(editingId)} className="text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" onClick={save} disabled={saving || uploading || !form.title.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage columns */}
      <Dialog open={colsOpen} onOpenChange={setColsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Board columns</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {draftCols.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button onClick={() => moveColumn(c.id, -1)} disabled={i === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveColumn(c.id, 1)} disabled={i === draftCols.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                <Input value={c.label} onChange={e => setColLabel(c.id, e.target.value)} className="flex-1" />
                <div className="flex items-center gap-1 shrink-0" title="Columns with the same row number sit side by side">
                  <span className="text-[10px] text-slate-400">Row</span>
                  <input type="number" min={1} value={c.row ?? 1}
                    onChange={e => setColRow(c.id, Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-11 text-sm border border-slate-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                {c.id === "done"
                  ? <span title="Completion column" className="text-emerald-500 w-6 text-center"><Check className="h-4 w-4 inline" /></span>
                  : <button onClick={() => removeColumn(c.id)} className="text-slate-300 hover:text-red-500 w-6 flex justify-center"><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
            <button onClick={addColumn} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline pt-1"><Plus className="h-4 w-4" /> Add column</button>
            <p className="text-xs text-slate-400 pt-1">Give columns the same <strong>Row</strong> number to place them on one line (e.g. To do · In progress · Done on row 1; Delegate · Later on row 2). The <strong>Done</strong> column can be renamed but not removed; deleting a column moves its tasks to the first.</p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
            <Button type="button" variant="outline" onClick={() => setColsOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveColumns}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachment viewer */}
      {viewer && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setViewer(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-700 truncate">{viewer.name}</span>
              <div className="flex items-center gap-3">
                <a href={viewer.url} download={viewer.name} className="text-xs text-blue-600 hover:underline">Download</a>
                <button onClick={() => setViewer(null)}><X className="h-4 w-4 text-slate-400" /></button>
              </div>
            </div>
            <div className="overflow-auto p-2 bg-slate-50">
              {viewer.type.startsWith("image/")
                ? <img src={viewer.url} alt={viewer.name} className="max-w-full mx-auto rounded" />
                : <iframe src={viewer.url} className="w-full h-[70vh] rounded" title={viewer.name} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
