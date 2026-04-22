import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const fullInclude = {
  contact: true,
  currency: true,
  payments: { include: { currency: true }, orderBy: { date: "desc" as const } },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receivable = await prisma.receivable.findUnique({ where: { id }, include: fullInclude });
    if (!receivable) return NextResponse.json({ error: "Receivable not found" }, { status: 404 });
    return NextResponse.json(receivable);
  } catch {
    return NextResponse.json({ error: "Failed to fetch receivable" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { contactId, currencyId, originalAmount, description, agreementDate, dueDate, note, status, attachmentUrl } = body;

    // If originalAmount is being changed, recalculate remaining and status
    let recalc: { remainingAmount?: number; status?: string } = {};
    if (originalAmount !== undefined) {
      const current = await prisma.receivable.findUnique({
        where: { id },
        select: { paidAmount: true },
      });
      const paidAmount = current?.paidAmount ?? 0;
      const remainingAmount = Math.max(0, originalAmount - paidAmount);
      const newStatus = remainingAmount <= 0 ? "settled" : paidAmount > 0 ? "partial" : "open";
      recalc = { remainingAmount, status: newStatus };
    }

    const receivable = await prisma.receivable.update({
      where: { id },
      data: {
        ...(contactId !== undefined && { contactId }),
        ...(currencyId !== undefined && { currencyId }),
        ...(originalAmount !== undefined && { originalAmount }),
        ...(description !== undefined && { description }),
        ...(agreementDate !== undefined && { agreementDate: new Date(agreementDate) }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(note !== undefined && { note }),
        // Only apply explicit status if originalAmount not changed (avoid overwriting recalc)
        ...(status !== undefined && originalAmount === undefined && { status }),
        ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl ?? null }),
        ...recalc,
      },
      include: fullInclude,
    });

    return NextResponse.json(receivable);
  } catch {
    return NextResponse.json({ error: "Failed to update receivable" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.receivedPayment.deleteMany({ where: { receivableId: id } });
    await prisma.receivable.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete receivable" }, { status: 500 });
  }
}
