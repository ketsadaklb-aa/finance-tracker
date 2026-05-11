import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Compute the balance delta a transaction applies to its owning account.
function delta(type: string, amount: number): number {
  if (type === "income" || type === "transfer-in") return amount;
  return -amount;
}

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

    // Editing a transfer leg is restricted: only date/description/attachment may change,
    // and the change is mirrored to the partner leg. Amount/account/type changes require
    // delete + recreate (UX: user can delete the pair, then add a new transfer).
    if (old.transferGroupId) {
      if (type !== undefined || amount !== undefined || accountId !== undefined) {
        return NextResponse.json(
          { error: "To change amount/account/type of a transfer, delete this transfer and create a new one." },
          { status: 400 },
        );
      }
      const patch = {
        ...(date        !== undefined && { date: new Date(date) }),
        ...(description !== undefined && { description }),
        ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl ?? null }),
      };
      const updated = await prisma.transaction.update({
        where: { id }, data: patch,
        include: { account: true, currency: true, category: true },
      });
      // Mirror to the partner leg
      await prisma.transaction.updateMany({
        where: { transferGroupId: old.transferGroupId, NOT: { id } },
        data: patch,
      });
      return NextResponse.json(updated);
    }

    // Single-leg edit (income / expense / withdrawal)
    const newType      = type      ?? old.type;
    const newAmount    = amount    ?? old.amount;
    const newAccountId = accountId ?? old.accountId;

    const oldDelta = delta(old.type, old.amount);
    const newDelta = delta(newType, newAmount);

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(type        !== undefined && { type }),
        ...(amount      !== undefined && { amount }),
        ...(accountId   !== undefined && { accountId }),
        ...(categoryId  !== undefined && { categoryId }),
        ...(date        !== undefined && { date: new Date(date) }),
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
    console.error(error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Delete both legs of a transfer atomically
    if (tx.transferGroupId) {
      const legs = await prisma.transaction.findMany({
        where: { transferGroupId: tx.transferGroupId },
      });
      // Reverse each leg's balance impact
      const ops = legs.flatMap(leg => ([
        prisma.account.update({
          where: { id: leg.accountId },
          data: { balance: { increment: -delta(leg.type, leg.amount) } },
        }),
      ]));
      await prisma.$transaction([
        ...ops,
        prisma.transaction.deleteMany({ where: { transferGroupId: tx.transferGroupId } }),
      ]);
      return NextResponse.json({ success: true });
    }

    // Single-leg delete
    const d = delta(tx.type, tx.amount);
    await prisma.$transaction([
      prisma.transaction.delete({ where: { id } }),
      prisma.account.update({
        where: { id: tx.accountId },
        data: { balance: { increment: -d } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
