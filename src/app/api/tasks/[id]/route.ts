import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { taskInclude } from "@/lib/task-include";

// Owner or assignee may view/edit; only the owner may delete.
async function access(id: string, mode: "edit" | "delete") {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const task = await prisma.task.findUnique({ where: { id }, select: { ownerId: true, assigneeId: true } });
  if (!task) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const me = session.user.id;
  const allowed = mode === "delete" ? task.ownerId === me : task.ownerId === me || task.assigneeId === me;
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await access(id, "edit");
  if (auth.error) return auth.error;

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.title === "string" && b.title.trim()) data.title = b.title.trim();
  if (b.description !== undefined) data.description = b.description || null;
  if (["todo", "doing", "done"].includes(b.status)) data.status = b.status;
  if (["low", "medium", "high"].includes(b.priority)) data.priority = b.priority;
  if (b.dueDate !== undefined) data.dueDate = b.dueDate ? new Date(b.dueDate) : null;
  if (b.dueTime !== undefined) data.dueTime = b.dueTime || null;
  if (b.assigneeId !== undefined) data.assigneeId = b.assigneeId || null;
  if (b.checklist !== undefined) data.checklist = Array.isArray(b.checklist) ? b.checklist : null;
  if (b.attachments !== undefined) data.attachments = Array.isArray(b.attachments) ? b.attachments : null;
  if (b.archivedAt !== undefined) data.archivedAt = b.archivedAt ? new Date(b.archivedAt) : null;
  if (typeof b.order === "number") data.order = b.order;

  const task = await prisma.task.update({ where: { id }, data, include: taskInclude });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await access(id, "delete");
  if (auth.error) return auth.error;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
