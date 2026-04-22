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
    const payable = await prisma.payable.findUnique({ where: { id }, include: fullInclude });
    if (!payable) return NextResponse.json({ error: "Payable not found" }, { status: 404 });
    return NextResponse.json(payable);
  } catch {
    return NextResponse.json({ error: "Failed to fetch payable" }, { status: 500 });
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

    let recalc: { remainingAmount?: number; status?: string } = {};
    if (originalAmount !== undefined) {
      const current = await prisma.payable.findUnique({
        where: { id },
        select: { paidAmount: true },
      });
      const paidAmount = current?.paidAmount ?? 0;
      const remainingAmount = Math.max(0, originalAmount - paidAmount);
      const newStatus = remainingAmount <= 0 ? "settled" : paidAmount > 0 ? "partial" : "open";
      recalc = { remainingAmount, status: newStatus };
    }

    const payable = await prisma.payable.update({
      where: { id },
      data: {
        ...(contactId !== undefined && { contactId }),
        ...(currencyId !== undefined && { currencyId }),
        ...(originalAmount !== undefined && { originalAmount }),
        ...(description !== undefined && { description }),
        ...(agreementDate !== undefined && { agreementDate: new Date(agreementDate) }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(note !== undefined && { note }),
        ...(status !== undefined && originalAmount === undefined && { status }),
        ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl ?? null }),
        ...recalc,
      },
      include: fullInclude,
    });

    return NextResponse.json(payable);
  } catch {
    return NextResponse.json({ error: "Failed to update payable" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.madePayment.deleteMany({ where: { payableId: id } });
    await prisma.payable.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete payable" }, { status: 500 });
  }
}
