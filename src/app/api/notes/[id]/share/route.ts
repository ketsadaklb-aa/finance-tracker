import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateShareToken } from "@/lib/share";

async function owned(id: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const note = await prisma.note.findUnique({ where: { id }, select: { ownerId: true, shareToken: true } });
  if (!note) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (note.ownerId !== session.user.id) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { note };
}

// GET — current share status
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await owned(id);
  if (auth.error) return auth.error;
  return NextResponse.json({ enabled: !!auth.note.shareToken, token: auth.note.shareToken });
}

// POST — enable sharing (reuse existing token if any)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await owned(id);
  if (auth.error) return auth.error;
  const token = auth.note.shareToken ?? generateShareToken();
  await prisma.note.update({ where: { id }, data: { shareToken: token } });
  return NextResponse.json({ enabled: true, token });
}

// DELETE — revoke the public link
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await owned(id);
  if (auth.error) return auth.error;
  await prisma.note.update({ where: { id }, data: { shareToken: null } });
  return NextResponse.json({ enabled: false });
}
