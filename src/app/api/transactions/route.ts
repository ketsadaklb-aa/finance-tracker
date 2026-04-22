import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getVisibleAccountIds } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const visibleIds = await getVisibleAccountIds(session.user.id, session.user.role);

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type");
    const currencyId = searchParams.get("currencyId");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const accountIdFilter = accountId
      ? visibleIds ? (visibleIds.includes(accountId) ? accountId : null) : accountId
      : undefined;

    if (accountId && accountIdFilter === null) return NextResponse.json([]);

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(visibleIds && !accountId && { accountId: { in: visibleIds } }),
        ...(accountIdFilter && { accountId: accountIdFilter }),
        ...(type && { type }),
        ...(currencyId && { currencyId }),
      },
      include: {
        account: true,
        currency: true,
        category: true,
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { type, amount, accountId, categoryId, date, description, attachmentUrl } = body;

    // Derive currencyId from the account
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { currencyId: true } });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const currencyId = account.currencyId;

    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount,
        currencyId,
        accountId,
        categoryId,
        date: new Date(date),
        description,
        source: "manual",
        attachmentUrl: attachmentUrl ?? null,
      },
      include: {
        account: true,
        currency: true,
        category: true,
      },
    });

    // Update account balance based on transaction type
    const balanceDelta =
      type === "income" || type === "transfer-in" ? amount : -amount;

    await prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: balanceDelta } },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
