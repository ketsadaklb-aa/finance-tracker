import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getVisibleAccountIds, getVisibleContactIds } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [visibleAccountIds, visibleContactIds] = await Promise.all([
    getVisibleAccountIds(session.user.id, session.user.role),
    getVisibleContactIds(session.user.id, session.user.role),
  ]);

  const accountFilter = visibleAccountIds !== null && visibleAccountIds.length > 0
    ? { id: { in: visibleAccountIds } } : visibleAccountIds === null ? {} : { id: { in: ["__none__"] } };
  const txAccountFilter = visibleAccountIds !== null && visibleAccountIds.length > 0
    ? { accountId: { in: visibleAccountIds } } : visibleAccountIds === null ? {} : { accountId: { in: ["__none__"] } };
  const contactFilter = visibleContactIds !== null && visibleContactIds.length > 0
    ? { contactId: { in: visibleContactIds } } : visibleContactIds === null ? {} : { contactId: { in: ["__none__"] } };

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth()), 10);
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    const currencies = await prisma.currency.findMany();
    const currencyMap = new Map(currencies.map((c) => [c.id, c]));

    // --- Net Worth ---
    const accounts = await prisma.account.findMany({ where: accountFilter, select: { currencyId: true, balance: true } });
    const accountBalanceByCurrency: Record<string, number> = {};
    for (const a of accounts) {
      accountBalanceByCurrency[a.currencyId] = (accountBalanceByCurrency[a.currencyId] ?? 0) + a.balance;
    }

    const openReceivables = await prisma.receivable.findMany({
      where: { status: { in: ["open", "partial"] }, ...contactFilter },
      select: { currencyId: true, remainingAmount: true },
    });
    const arByCurrency: Record<string, number> = {};
    for (const r of openReceivables) {
      arByCurrency[r.currencyId] = (arByCurrency[r.currencyId] ?? 0) + r.remainingAmount;
    }

    const openPayables = await prisma.payable.findMany({
      where: { status: { in: ["open", "partial"] }, ...contactFilter },
      select: { currencyId: true, remainingAmount: true },
    });
    const apByCurrency: Record<string, number> = {};
    for (const p of openPayables) {
      apByCurrency[p.currencyId] = (apByCurrency[p.currencyId] ?? 0) + p.remainingAmount;
    }

    const netWorth: Record<string, { symbol: string; balance: number; ar: number; ap: number; net: number }> = {};
    const allCurrencyIds = new Set([
      ...Object.keys(accountBalanceByCurrency),
      ...Object.keys(arByCurrency),
      ...Object.keys(apByCurrency),
    ]);
    for (const currencyId of allCurrencyIds) {
      const currency = currencyMap.get(currencyId);
      if (!currency) continue;
      const balance = accountBalanceByCurrency[currencyId] ?? 0;
      const ar = arByCurrency[currencyId] ?? 0;
      const ap = apByCurrency[currencyId] ?? 0;
      netWorth[currency.code] = { symbol: currency.symbol, balance, ar, ap, net: balance + ar - ap };
    }

    // --- Recent Transactions ---
    const recentTransactions = await prisma.transaction.findMany({
      where: txAccountFilter,
      include: { account: true, currency: true, category: true },
      orderBy: { date: "desc" },
      take: 10,
    });

    // --- AR Summary + overdue ---
    const allReceivables = await prisma.receivable.findMany({
      where: contactFilter,
      select: { status: true, currencyId: true, remainingAmount: true, dueDate: true },
    });
    const arSummary = {
      open: 0, partial: 0, settled: 0, overdue: 0,
      totalByCurrency: {} as Record<string, { symbol: string; remaining: number }>,
    };
    for (const r of allReceivables) {
      if (r.status === "open") arSummary.open++;
      else if (r.status === "partial") arSummary.partial++;
      else if (r.status === "settled") arSummary.settled++;
      if (r.status !== "settled" && r.dueDate && new Date(r.dueDate) < now) arSummary.overdue++;
      if (r.status !== "settled") {
        const currency = currencyMap.get(r.currencyId);
        if (currency) {
          if (!arSummary.totalByCurrency[currency.code])
            arSummary.totalByCurrency[currency.code] = { symbol: currency.symbol, remaining: 0 };
          arSummary.totalByCurrency[currency.code].remaining += r.remainingAmount;
        }
      }
    }

    // --- AP Summary + overdue ---
    const allPayables = await prisma.payable.findMany({
      where: contactFilter,
      select: { status: true, currencyId: true, remainingAmount: true, dueDate: true },
    });
    const apSummary = {
      open: 0, partial: 0, settled: 0, overdue: 0,
      totalByCurrency: {} as Record<string, { symbol: string; remaining: number }>,
    };
    for (const p of allPayables) {
      if (p.status === "open") apSummary.open++;
      else if (p.status === "partial") apSummary.partial++;
      else if (p.status === "settled") apSummary.settled++;
      if (p.status !== "settled" && p.dueDate && new Date(p.dueDate) < now) apSummary.overdue++;
      if (p.status !== "settled") {
        const currency = currencyMap.get(p.currencyId);
        if (currency) {
          if (!apSummary.totalByCurrency[currency.code])
            apSummary.totalByCurrency[currency.code] = { symbol: currency.symbol, remaining: 0 };
          apSummary.totalByCurrency[currency.code].remaining += p.remainingAmount;
        }
      }
    }

    // --- Monthly Totals (income/expense/withdrawal — withdrawal kept separate so it doesn't pollute spending) ---
    const monthlyTransactions = await prisma.transaction.findMany({
      where: { ...txAccountFilter, date: { gte: startOfMonth, lte: endOfMonth }, type: { in: ["income", "expense", "withdrawal"] } },
      select: { type: true, amount: true, currencyId: true },
    });
    const monthlyTotals: {
      income:     Record<string, { symbol: string; total: number }>;
      expense:    Record<string, { symbol: string; total: number }>;
      withdrawal: Record<string, { symbol: string; total: number }>;
    } = { income: {}, expense: {}, withdrawal: {} };
    for (const tx of monthlyTransactions) {
      const currency = currencyMap.get(tx.currencyId);
      if (!currency) continue;
      const bucket =
        tx.type === "income"     ? monthlyTotals.income
      : tx.type === "withdrawal" ? monthlyTotals.withdrawal
      :                            monthlyTotals.expense;
      if (!bucket[currency.code]) bucket[currency.code] = { symbol: currency.symbol, total: 0 };
      bucket[currency.code].total += tx.amount;
    }

    return NextResponse.json({ netWorth, recentTransactions, arSummary, apSummary, monthlyTotals });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
