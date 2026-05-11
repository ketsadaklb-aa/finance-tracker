import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getVisibleAccountIds, getVisibleContactIds } from "@/lib/auth";

function isCurrentMonthQuery(now: Date, year: number, month: number): boolean {
  return now.getFullYear() === year && now.getMonth() === month;
}

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
    const startOfPrevMonth = new Date(year, month - 1, 1);
    const endOfPrevMonth = new Date(year, month, 0, 23, 59, 59);

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
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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

    // --- Previous Month Totals (for vs-last-month delta) ---
    const prevMonthTx = await prisma.transaction.findMany({
      where: { ...txAccountFilter, date: { gte: startOfPrevMonth, lte: endOfPrevMonth }, type: { in: ["income", "expense"] } },
      select: { type: true, amount: true, currencyId: true },
    });
    const prevMonthTotals: { income: Record<string, number>; expense: Record<string, number> } = { income: {}, expense: {} };
    for (const tx of prevMonthTx) {
      const currency = currencyMap.get(tx.currencyId);
      if (!currency) continue;
      const bucket = tx.type === "income" ? prevMonthTotals.income : prevMonthTotals.expense;
      bucket[currency.code] = (bucket[currency.code] ?? 0) + tx.amount;
    }

    // --- Spending & Income by Category (current month) ---
    const currentMonthDetailed = await prisma.transaction.findMany({
      where: { ...txAccountFilter, date: { gte: startOfMonth, lte: endOfMonth }, type: { in: ["income", "expense"] } },
      select: { type: true, amount: true, currencyId: true, categoryId: true, date: true, description: true },
    });
    const categories = await prisma.category.findMany({ select: { id: true, name: true } });
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    // shape: { [currencyCode]: [{ category, amount }] }
    const expenseByCategoryRaw: Record<string, Record<string, number>> = {};
    const incomeByCategoryRaw:  Record<string, Record<string, number>> = {};
    for (const tx of currentMonthDetailed) {
      const currency = currencyMap.get(tx.currencyId);
      if (!currency) continue;
      const catName = tx.categoryId ? (catMap.get(tx.categoryId) ?? "Uncategorized") : "Uncategorized";
      const bucket = tx.type === "income" ? incomeByCategoryRaw : expenseByCategoryRaw;
      if (!bucket[currency.code]) bucket[currency.code] = {};
      bucket[currency.code][catName] = (bucket[currency.code][catName] ?? 0) + tx.amount;
    }
    const buildCategoryArray = (raw: Record<string, Record<string, number>>) =>
      Object.fromEntries(Object.entries(raw).map(([code, cats]) => {
        const total = Object.values(cats).reduce((s, n) => s + n, 0);
        const arr = Object.entries(cats)
          .map(([category, amount]) => ({ category, amount, percentage: total > 0 ? (amount / total) * 100 : 0 }))
          .sort((a, b) => b.amount - a.amount);
        return [code, arr];
      }));
    const spendingByCategory = buildCategoryArray(expenseByCategoryRaw);
    const incomeByCategory   = buildCategoryArray(incomeByCategoryRaw);

    // --- Daily Trend (current month) ---
    // For each day 1..lastDay, sum income and expense per currency
    const lastDay = endOfMonth.getDate();
    const dailyTrend: Record<string, { day: number; income: number; expense: number }[]> = {};
    for (const tx of currentMonthDetailed) {
      const currency = currencyMap.get(tx.currencyId);
      if (!currency) continue;
      if (!dailyTrend[currency.code]) {
        dailyTrend[currency.code] = Array.from({ length: lastDay }, (_, i) => ({ day: i + 1, income: 0, expense: 0 }));
      }
      const day = tx.date.getDate();
      const entry = dailyTrend[currency.code][day - 1];
      if (tx.type === "income") entry.income += tx.amount;
      else entry.expense += tx.amount;
    }

    // --- Six-Month History (current month included) ---
    const sixMonthsAgo = new Date(year, month - 5, 1);
    const sixMonthTx = await prisma.transaction.findMany({
      where: { ...txAccountFilter, date: { gte: sixMonthsAgo, lte: endOfMonth }, type: { in: ["income", "expense"] } },
      select: { type: true, amount: true, currencyId: true, date: true },
    });
    type MonthBucket = { month: number; year: number; income: number; expense: number };
    const historicalMonths: Record<string, MonthBucket[]> = {};
    // Pre-seed all 6 months so even empty ones appear in the chart
    for (let i = 0; i < 6; i++) {
      const d = new Date(year, month - 5 + i, 1);
      for (const c of currencies) {
        if (!historicalMonths[c.code]) historicalMonths[c.code] = [];
        historicalMonths[c.code].push({ month: d.getMonth(), year: d.getFullYear(), income: 0, expense: 0 });
      }
    }
    for (const tx of sixMonthTx) {
      const currency = currencyMap.get(tx.currencyId);
      if (!currency) continue;
      const m = tx.date.getMonth();
      const y = tx.date.getFullYear();
      const bucket = historicalMonths[currency.code]?.find(b => b.month === m && b.year === y);
      if (!bucket) continue;
      if (tx.type === "income") bucket.income += tx.amount;
      else bucket.expense += tx.amount;
    }

    // --- Top 3 Expenses This Month ---
    const topExpenses = currentMonthDetailed
      .filter(t => t.type === "expense")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map(t => {
        const currency = currencyMap.get(t.currencyId)!;
        return {
          amount: t.amount,
          description: t.description,
          category: t.categoryId ? catMap.get(t.categoryId) ?? null : null,
          date: t.date,
          currency: { code: currency.code, symbol: currency.symbol },
        };
      });

    // --- Avg Daily Spend (per currency, this month, based on days elapsed) ---
    const dayCount = isCurrentMonthQuery(now, year, month) ? now.getDate() : lastDay;
    const avgDailySpend: Record<string, { symbol: string; total: number }> = {};
    for (const [code, totals] of Object.entries(monthlyTotals.expense)) {
      avgDailySpend[code] = { symbol: totals.symbol, total: totals.total / Math.max(dayCount, 1) };
    }

    return NextResponse.json({
      netWorth, recentTransactions, arSummary, apSummary, monthlyTotals, prevMonthTotals,
      spendingByCategory, incomeByCategory, dailyTrend, historicalMonths, topExpenses, avgDailySpend,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
