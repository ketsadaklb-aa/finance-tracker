import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getVisibleContactIds } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const visibleIds = await getVisibleContactIds(session.user.id, session.user.role);
    if (visibleIds !== null && visibleIds.length === 0)
      return NextResponse.json([]);

    const contacts = await prisma.contact.findMany({
      where: visibleIds !== null ? { id: { in: visibleIds } } : undefined,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { receivables: true, payables: true } },
      },
    });
    return NextResponse.json(contacts);
  } catch {
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, phone, note } = body;
    const contact = await prisma.contact.create({ data: { name, phone, note } });
    return NextResponse.json(contact, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
