import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPin, isValidPin, checkRateLimit, recordFailedAttempt, clearAttempts } from "@/lib/share";

// PUBLIC (no session) — exempted in middleware. Two steps:
//   GET  → confirms the link is live and returns only the contact name (for the PIN prompt).
//   POST → verifies the PIN, then returns the read-only ledger with attachments.

const recordSelect = {
  id: true,
  originalAmount: true,
  paidAmount: true,
  remainingAmount: true,
  status: true,
  description: true,
  agreementDate: true,
  dueDate: true,
  note: true,
  attachmentUrl: true,
  currency: { select: { code: true, symbol: true } },
  payments: {
    select: {
      id: true,
      amount: true,
      date: true,
      note: true,
      attachmentUrl: true,
      currency: { select: { code: true, symbol: true } },
    },
    orderBy: { date: "desc" as const },
  },
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contact = await prisma.contact.findUnique({
    where: { shareToken: token },
    select: { name: true },
  });
  if (!contact) return NextResponse.json({ error: "This link is no longer active." }, { status: 404 });
  return NextResponse.json({ contactName: contact.name, requiresPin: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rate = checkRateLimit(token);
  if (!rate.allowed)
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rate.retryAfterMin} minute(s).` },
      { status: 429 }
    );

  const body = await req.json().catch(() => ({}));
  if (!isValidPin(body.pin))
    return NextResponse.json({ error: "Enter the 4–6 digit PIN." }, { status: 400 });

  const contact = await prisma.contact.findUnique({
    where: { shareToken: token },
    select: {
      name: true,
      sharePinHash: true,
      receivables: { select: recordSelect, orderBy: { agreementDate: "desc" } },
      payables: { select: recordSelect, orderBy: { agreementDate: "desc" } },
    },
  });
  if (!contact) return NextResponse.json({ error: "This link is no longer active." }, { status: 404 });

  if (!verifyPin(body.pin, token, contact.sharePinHash)) {
    recordFailedAttempt(token);
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  clearAttempts(token);
  return NextResponse.json({
    contact: { name: contact.name },
    receivables: contact.receivables,
    payables: contact.payables,
    generatedAt: new Date().toISOString(),
  });
}
