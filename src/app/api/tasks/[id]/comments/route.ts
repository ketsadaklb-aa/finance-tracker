import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST — add a comment to a task the user owns.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id }, select: { ownerId: true, assignees: { select: { userId: true } } } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = session.user.id;
  if (task.ownerId !== me && !task.assignees.some(a => a.userId === me)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const body = typeof b.body === "string" ? b.body.trim() : "";
  if (!body) return NextResponse.json({ error: "Comment is empty" }, { status: 400 });

  const comment = await prisma.taskComment.create({
    data: { taskId: id, authorId: session.user.id, body },
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json(comment, { status: 201 });
}
