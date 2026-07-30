import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { taskInclude } from "@/lib/task-include";

// GET — tasks the user owns OR is assigned. ?archived=1 returns the archive.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = session.user.id;
  const archived = new URL(req.url).searchParams.get("archived") === "1";

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        { OR: [{ ownerId: me }, { assigneeId: me }] },
        archived ? { NOT: { archivedAt: null } } : { archivedAt: null },
      ],
    },
    include: taskInclude,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(tasks);
}

// POST — create a task (owned by the creator). Drops to the bottom of its column.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const status = typeof b.status === "string" && b.status.trim() ? b.status.trim() : "todo";
  const last = await prisma.task.findFirst({
    where: { ownerId: session.user.id, status },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const task = await prisma.task.create({
    data: {
      title,
      description: b.description || null,
      status,
      priority: ["low", "medium", "high"].includes(b.priority) ? b.priority : "medium",
      dueDate: b.dueDate ? new Date(b.dueDate) : null,
      dueTime: b.dueTime || null,
      durationMin: typeof b.durationMin === "number" ? b.durationMin : undefined,
      assigneeId: b.assigneeId || null,
      checklist: Array.isArray(b.checklist) ? b.checklist : undefined,
      attachments: Array.isArray(b.attachments) ? b.attachments : undefined,
      tags: Array.isArray(b.tags) ? b.tags : undefined,
      order: (last?.order ?? 0) + 1,
      ownerId: session.user.id,
    },
    include: taskInclude,
  });
  return NextResponse.json(task, { status: 201 });
}
