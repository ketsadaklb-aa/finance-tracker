import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/admin/accounts/[id]/access — list user IDs that have access to this account
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const access = await prisma.accountAccess.findMany({
    where: { accountId: id },
    select: { userId: true },
  });
  return NextResponse.json(access.map((a) => a.userId));
}

// PUT /api/admin/accounts/[id]/access — replace full access list for this account
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: accountId } = await params;
  const { userIds }: { userIds: string[] } = await request.json();

  await prisma.accountAccess.deleteMany({ where: { accountId } });

  if (userIds.length > 0) {
    await prisma.accountAccess.createMany({
      data: userIds.map((userId) => ({ userId, accountId })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true });
}
