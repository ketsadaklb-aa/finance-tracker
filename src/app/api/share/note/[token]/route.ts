import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PUBLIC (middleware-exempt) — read-only note scene for the share page.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const note = await prisma.note.findUnique({
    where: { shareToken: token },
    select: { title: true, data: true },
  });
  if (!note) return NextResponse.json({ error: "This link is no longer active." }, { status: 404 });
  return NextResponse.json(note);
}
