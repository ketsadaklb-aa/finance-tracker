import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const rows = await prisma.contactAccess.findMany({
    where: { contactId: id },
    select: { userId: true },
  });
  return NextResponse.json(rows.map((r) => r.userId));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { userIds }: { userIds: string[] } = await request.json();

  await prisma.contactAccess.deleteMany({ where: { contactId: id } });
  if (userIds.length > 0) {
    await prisma.contactAccess.createMany({
      data: userIds.map((userId) => ({ contactId: id, userId })),
    });
  }
  return NextResponse.json({ ok: true });
}
