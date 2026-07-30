import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST — archive all of the user's own "done" tasks (clears them off the board).
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await prisma.task.updateMany({
    where: { ownerId: session.user.id, status: "done", archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return NextResponse.json({ archived: result.count });
}
