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
    const payments = await prisma.madePayment.findMany({
      where: { payableId: id },
      include: { currency: true },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(payments);
  } catch {
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, date, note, attachmentUrl } = body;

    const payable = await prisma.payable.findUnique({ where: { id } });
    if (!payable) return NextResponse.json({ error: "Payable not found" }, { status: 404 });

    if (amount <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    if (amount > payable.remainingAmount + 0.001)
      return NextResponse.json({ error: `Amount exceeds remaining balance (${payable.remainingAmount})` }, { status: 400 });

    await prisma.madePayment.create({
      data: { payableId: id, currencyId: payable.currencyId, amount, date: new Date(date), note, attachmentUrl: attachmentUrl ?? null },
    });

    const aggregate = await prisma.madePayment.aggregate({
      where: { payableId: id },
      _sum: { amount: true },
    });

    const paidAmount = aggregate._sum.amount ?? 0;
    const remainingAmount = Math.max(0, payable.originalAmount - paidAmount);
    const status = remainingAmount <= 0 ? "settled" : paidAmount > 0 ? "partial" : "open";

    const updatedPayable = await prisma.payable.update({
      where: { id },
      data: { paidAmount, remainingAmount, status },
      include: fullInclude,
    });

    return NextResponse.json(updatedPayable, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to log payment" }, { status: 500 });
  }
}
