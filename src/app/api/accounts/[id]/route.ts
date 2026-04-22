import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, type, balance, note } = body;

    const account = await prisma.account.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(balance !== undefined && { balance }),
        ...(note !== undefined && { note }),
      },
      include: { currency: true },
    });

    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const txCount = await prisma.transaction.count({ where: { accountId: id } });
    if (txCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: this account has ${txCount} transaction(s). Delete transactions first.` },
        { status: 409 }
      );
    }

    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
