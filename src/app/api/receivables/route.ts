import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const paymentInclude = { include: { currency: true }, orderBy: { date: "desc" as const } };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    const receivables = await prisma.receivable.findMany({
      where: {
        ...(contactId && { contactId }),
      },
      include: {
        contact: true,
        currency: true,
        payments: paymentInclude,
      },
      orderBy: { agreementDate: "desc" },
    });

    return NextResponse.json(receivables);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch receivables" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, currencyId, originalAmount, description, agreementDate, dueDate, note, attachmentUrl } = body;

    const receivable = await prisma.receivable.create({
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

    return NextResponse.json(receivable, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create receivable" }, { status: 500 });
  }
}
