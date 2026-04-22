import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getVisibleContactIds } from "@/lib/auth";

const paymentInclude = { include: { currency: true }, orderBy: { date: "desc" as const } };

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    const visibleIds = await getVisibleContactIds(session.user.id, session.user.role);
    if (visibleIds !== null && visibleIds.length === 0)
      return NextResponse.json([]);

    const payables = await prisma.payable.findMany({
      where: {
        ...(contactId && { contactId }),
        ...(visibleIds !== null && { contactId: { in: visibleIds } }),
      },
      include: {
        contact: true,
        currency: true,
        payments: paymentInclude,
      },
      orderBy: { agreementDate: "desc" },
    });

    return NextResponse.json(payables);
  } catch {
    return NextResponse.json({ error: "Failed to fetch payables" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, currencyId, originalAmount, description, agreementDate, dueDate, note, attachmentUrl } = body;

    const payable = await prisma.payable.create({
      data: {
        contactId,
        currencyId,
        originalAmount,
        remainingAmount: originalAmount,
        description,
        agreementDate: new Date(agreementDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        note,
        status: "open",
        attachmentUrl: attachmentUrl ?? null,
      },
      include: {
        contact: true,
        currency: true,
        payments: paymentInclude,
      },
    });

    return NextResponse.json(payable, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create payable" }, { status: 500 });
  }
}
