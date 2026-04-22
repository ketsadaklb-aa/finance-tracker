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
    const payments = await prisma.receivedPayment.findMany({
      where: { receivableId: id },
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

    const receivable = await prisma.receivable.findUnique({ where: { id } });
    if (!receivable) return NextResponse.json({ error: "Receivable not found" }, { status: 404 });

    if (amount <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    if (amount > receivable.remainingAmount + 0.001)
      return NextResponse.json({ error: `Amount exceeds remaining balance (${receivable.remainingAmount})` }, { status: 400 });

    await prisma.receivedPayment.create({
      data: { receivableId: id, currencyId: receivable.currencyId, amount, date: new Date(date), note, attachmentUrl: attachmentUrl ?? null },
    });

    const aggregate = await prisma.receivedPayment.aggregate({
      where: { receivableId: id },
      _sum: { amount: true },
    });

    const paidAmount = aggregate._sum.amount ?? 0;
    const remainingAmount = Math.max(0, receivable.originalAmount - paidAmount);
    const status = remainingAmount <= 0 ? "settled" : paidAmount > 0 ? "partial" : "open";

    const updatedReceivable = await prisma.receivable.update({
      where: { id },
      data: { paidAmount, remainingAmount, status },
      include: fullInclude,
    });

    return NextResponse.json(updatedReceivable, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to log payment" }, { status: 500 });
  }
}
