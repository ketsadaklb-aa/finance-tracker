import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getVisibleContactIds } from "@/lib/auth";
import { generateShareToken, hashPin, isValidPin } from "@/lib/share";

// Ensure the caller is logged in AND allowed to see this contact.
async function authorize(contactId: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const visibleIds = await getVisibleContactIds(session.user.id, session.user.role);
  if (visibleIds !== null && !visibleIds.includes(contactId))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

// GET — current share status (never returns the PIN, only whether one is set).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.error) return auth.error;

  const contact = await prisma.contact.findUnique({
    where: { id },
    select: { shareToken: true, sharePinHash: true, sharedAt: true },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    enabled: !!contact.shareToken,
    token: contact.shareToken,
    hasPin: !!contact.sharePinHash,
    sharedAt: contact.sharedAt,
  });
}

// POST — enable sharing / set (or reset) the PIN.
// Body: { pin: "4-6 digits" }. Keeps the existing token if already shared.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  if (!isValidPin(body.pin))
    return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });

  const existing = await prisma.contact.findUnique({
    where: { id },
    select: { shareToken: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = existing.shareToken ?? generateShareToken();
  await prisma.contact.update({
    where: { id },
    data: { shareToken: token, sharePinHash: hashPin(body.pin, token), sharedAt: new Date() },
  });

  return NextResponse.json({ enabled: true, token, hasPin: true });
}

// DELETE — revoke the link entirely (invalidates the URL and PIN).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.error) return auth.error;

  await prisma.contact.update({
    where: { id },
    data: { shareToken: null, sharePinHash: null, sharedAt: null },
  });
  return NextResponse.json({ enabled: false });
}
