import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type, amount, accountId, categoryId, date, description, attachmentUrl } = body;

    const old = await prisma.transaction.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newType = type ?? old.type;
    const newAmount = amount ?? old.amount;
    const newAccountId = accountId ?? old.accountId;

    const oldDelta = old.type === "income" || old.type === "transfer-in" ? old.amount : -old.amount;
    const newDelta = newType === "income" || newType === "transfer-in" ? newAmount : -newAmount;

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(amount !== undefined && { amount }),
        ...(accountId !== undefined && { accountId }),
        ...(categoryId !== undefined && { categoryId }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(description !== undefined && { description }),
        ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl ?? null }),
      },
      include: { account: true, currency: true, category: true },
    });

    if (newAccountId !== old.accountId) {
      await prisma.account.update({ where: { id: old.accountId }, data: { balance: { increment: -oldDelta } } });
      await prisma.account.update({ where: { id: newAccountId }, data: { balance: { increment: newDelta } } });
    } else if (oldDelta !== newDelta) {
      await prisma.account.update({ where: { id: old.accountId }, data: { balance: { increment: newDelta - oldDelta } } });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const delta = tx.type === "income" || tx.type === "transfer-in" ? tx.amount : -tx.amount;

    await prisma.transaction.delete({ where: { id } });
    await prisma.account.update({
      where: { id: tx.accountId },
      data: { balance: { increment: -delta } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
