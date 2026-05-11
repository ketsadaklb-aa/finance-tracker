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
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return NextResponse.json(transactions);
  } catch {
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      type, amount, accountId, toAccountId, categoryId, date, description, attachmentUrl,
    } = body;

    // ─── Paired transfer: create two transactions in one DB transaction ────
    if (type === "transfer") {
      if (!accountId || !toAccountId)  return NextResponse.json({ error: "Transfer requires both source and destination accounts" }, { status: 400 });
      if (accountId === toAccountId)   return NextResponse.json({ error: "Source and destination must be different" }, { status: 400 });
      if (!amount || amount <= 0)      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });

      const [fromAccount, toAccount] = await Promise.all([
        prisma.account.findUnique({ where: { id: accountId },   select: { currencyId: true } }),
        prisma.account.findUnique({ where: { id: toAccountId }, select: { currencyId: true } }),
      ]);
      if (!fromAccount || !toAccount) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      if (fromAccount.currencyId !== toAccount.currencyId) {
        return NextResponse.json({ error: "Cross-currency transfers are not supported yet" }, { status: 400 });
      }

      const transferGroupId = crypto.randomUUID();
      const txDate = new Date(date);

      const [outLeg] = await prisma.$transaction([
        prisma.transaction.create({
          data: {
            type: "transfer-out",
            amount, currencyId: fromAccount.currencyId, accountId,
            categoryId: null, date: txDate, description,
            source: "manual", attachmentUrl: attachmentUrl ?? null,
            transferGroupId,
          },
          include: { account: true, currency: true, category: true },
        }),
        prisma.transaction.create({
          data: {
            type: "transfer-in",
            amount, currencyId: toAccount.currencyId, accountId: toAccountId,
            categoryId: null, date: txDate, description,
            source: "manual", attachmentUrl: attachmentUrl ?? null,
            transferGroupId,
          },
        }),
        prisma.account.update({ where: { id: accountId },   data: { balance: { decrement: amount } } }),
        prisma.account.update({ where: { id: toAccountId }, data: { balance: { increment: amount } } }),
      ]);

      return NextResponse.json(outLeg, { status: 201 });
    }

    // ─── Single-leg transaction (income / expense / withdrawal) ───────────
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { currencyId: true } });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const currencyId = account.currencyId;

    const transaction = await prisma.transaction.create({
      data: {
        type, amount, currencyId, accountId,
        categoryId, date: new Date(date), description,
        source: "manual", attachmentUrl: attachmentUrl ?? null,
      },
      include: { account: true, currency: true, category: true },
    });

    // income/other-in → +amount; everything else (expense / withdrawal / other-out) → -amount
    const balanceDelta = (type === "income" || type === "other-in") ? amount : -amount;

    await prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: balanceDelta } },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
