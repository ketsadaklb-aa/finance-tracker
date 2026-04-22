import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const paymentInclude = { include: { currency: true }, orderBy: { date: "desc" as const } };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    const payables = await prisma.payable.findMany({
      where: {
        ...(contactId && { contactId }),
      },
      include: {
        contact: true,
        currency: true,
        payments: paymentInclude,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payables);
  } catch (error) {
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
