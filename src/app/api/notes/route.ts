import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET — list the user's notes (metadata only, not the heavy scene data).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notes = await prisma.note.findMany({
    where: { ownerId: session.user.id },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(notes);
}

// POST — create a blank note and return it.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const note = await prisma.note.create({
    data: { title: (typeof b.title === "string" && b.title.trim()) || "Untitled", ownerId: session.user.id },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(note, { status: 201 });
}
