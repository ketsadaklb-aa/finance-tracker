import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function owned(id: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const note = await prisma.note.findUnique({ where: { id }, select: { ownerId: true } });
  if (!note) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (note.ownerId !== session.user.id) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

// GET — full note including the scene data (for the canvas).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await owned(id);
  if (auth.error) return auth.error;
  const note = await prisma.note.findUnique({ where: { id } });
  return NextResponse.json(note);
}

// PATCH — save title and/or scene data (autosave).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await owned(id);
  if (auth.error) return auth.error;

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.title === "string" && b.title.trim()) data.title = b.title.trim();
  if (b.data !== undefined) data.data = b.data;

  const note = await prisma.note.update({ where: { id }, data, select: { id: true, title: true, updatedAt: true } });
  return NextResponse.json(note);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await owned(id);
  if (auth.error) return auth.error;
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
