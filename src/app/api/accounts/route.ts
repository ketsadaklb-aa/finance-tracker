import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getVisibleAccountIds } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visibleIds = await getVisibleAccountIds(session.user.id, session.user.role);
  if (visibleIds !== null && visibleIds.length === 0)
    return NextResponse.json([]);

  const accounts = await prisma.account.findMany({
    where: visibleIds !== null ? { id: { in: visibleIds } } : {},
    include: { currency: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, type, balance, currencyId, note } = await request.json();
  const account = await prisma.account.create({
    data: { name, type, balance: balance ?? 0, currencyId, note },
    include: { currency: true },
  });
  return NextResponse.json(account, { status: 201 });
}
