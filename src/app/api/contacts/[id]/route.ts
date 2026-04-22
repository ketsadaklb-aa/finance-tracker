import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, note } = body;

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(note !== undefined && { note }),
      },
    });

    return NextResponse.json(contact);
  } catch {
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [receivableCount, payableCount] = await Promise.all([
      prisma.receivable.count({ where: { contactId: id } }),
      prisma.payable.count({ where: { contactId: id } }),
    ]);

    if (receivableCount > 0 || payableCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: this contact has ${receivableCount} receivable(s) and ${payableCount} payable(s). Settle or delete them first.` },
        { status: 409 }
      );
    }

    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}
