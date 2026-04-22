import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const fullInclude = {
  contact: true,
  currency: true,
  payments: { include: { currency: true }, orderBy: { date: "desc" as const } },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    const body = await request.json();
    const { attachmentUrl } = body;

    const payment = await prisma.madePayment.update({
      where: { id: paymentId },
      data: { attachmentUrl: attachmentUrl ?? null },
    });
    return NextResponse.json(payment);
  } catch {
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id, paymentId } = await params;

    const payment = await prisma.madePayment.findUnique({ where: { id: paymentId } });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    await prisma.madePayment.delete({ where: { id: paymentId } });

    const payable = await prisma.payable.findUnique({ where: { id } });
    if (!payable) return NextResponse.json({ error: "Payable not found" }, { status: 404 });

    const aggregate = await prisma.madePayment.aggregate({
      where: { payableId: id },
      _sum: { amount: true },
    });

    const paidAmount = aggregate._sum.amount ?? 0;
    const remainingAmount = Math.max(0, payable.originalAmount - paidAmount);
    const status = remainingAmount <= 0 ? "settled" : paidAmount > 0 ? "partial" : "open";

    const updated = await prisma.payable.update({
      where: { id },
      data: { paidAmount, remainingAmount, status },
      include: fullInclude,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 });
  }
}
