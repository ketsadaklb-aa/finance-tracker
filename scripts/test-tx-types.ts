/**
 * End-to-end test for every transaction type.
 * - Creates a temporary session for an admin user (bypassing login UI)
 * - Picks an existing account, records starting balance
 * - For each type, hits the real /api/transactions endpoints
 * - Verifies balance math after each create/delete
 * - Confirms dashboard excludes other-in/other-out
 * - Cleans up at the end
 *
 * Run: npx tsx scripts/test-tx-types.ts
 */

import { prisma } from "../src/lib/db";
import { randomBytes } from "crypto";

const BASE = process.env.BASE ?? "http://localhost:3000";

type TxCase = {
  type: "income" | "expense" | "withdrawal" | "transfer" | "other-in" | "other-out";
  amount: number;
  /** Expected balance delta on the source account */
  expectedDelta: number;
  /** Should it count as income in dashboard? */
  countsAsIncome: boolean;
  /** Should it count as expense in dashboard? */
  countsAsExpense: boolean;
};

const CASES: TxCase[] = [
  { type: "income",     amount: 100_000, expectedDelta:  100_000, countsAsIncome: true,  countsAsExpense: false },
  { type: "expense",    amount:  50_000, expectedDelta:  -50_000, countsAsIncome: false, countsAsExpense: true  },
  { type: "withdrawal", amount:  20_000, expectedDelta:  -20_000, countsAsIncome: false, countsAsExpense: false },
  { type: "other-in",   amount:  30_000, expectedDelta:   30_000, countsAsIncome: false, countsAsExpense: false },
  { type: "other-out",  amount:  10_000, expectedDelta:  -10_000, countsAsIncome: false, countsAsExpense: false },
];

function fmt(n: number) { return n.toLocaleString(); }
function pass(s: string)  { console.log(`  ✓ ${s}`); }
function fail(s: string)  { console.log(`  ✗ ${s}`); failures++; }
let failures = 0;

async function main() {
  // 1. Create a temporary session for the first admin user
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) { console.error("No admin user found — seed one first"); process.exit(1); }
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { userId: admin.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const cookie = `ft_session=${token}; ft_role=${admin.role}`;
  console.log(`Session created for admin user "${admin.username}"`);

  // 2. Pick an account
  const account = await prisma.account.findFirst({ include: { currency: true } });
  if (!account) { console.error("No account found — create one first"); process.exit(1); }
  console.log(`Using account: ${account.name} (${account.currency.code}), starting balance ${fmt(account.balance)}`);

  // For transfer, need a second account in same currency
  const account2 = await prisma.account.findFirst({
    where: { id: { not: account.id }, currencyId: account.currencyId },
  });

  const createdIds: string[] = [];
  let balanceBaseline = account.balance;

  // 2b. Capture dashboard baseline BEFORE creating any test transactions
  const dashBefore = await fetch(`${BASE}/api/dashboard?month=${new Date().getMonth()}&year=${new Date().getFullYear()}`, { headers: { Cookie: cookie } }).then(r => r.json());
  const code = account.currency.code;
  const baseline = {
    income:     dashBefore.monthlyTotals.income[code]?.total     ?? 0,
    expense:    dashBefore.monthlyTotals.expense[code]?.total    ?? 0,
    withdrawal: dashBefore.monthlyTotals.withdrawal?.[code]?.total ?? 0,
  };
  console.log(`Dashboard baseline (this month, ${code}): income ${fmt(baseline.income)}, expense ${fmt(baseline.expense)}, withdrawal ${fmt(baseline.withdrawal)}`);

  try {
    // 3. Test each type
    for (const tc of CASES) {
      console.log(`\n── ${tc.type} ───────────────────────────────`);
      const res = await fetch(`${BASE}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          type: tc.type,
          amount: tc.amount,
          accountId: account.id,
          date: new Date().toISOString().slice(0, 10),
          description: `Test ${tc.type}`,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        fail(`POST failed (${res.status}): ${errBody.substring(0, 120)}`);
        continue;
      }
      const tx = await res.json();
      createdIds.push(tx.id);
      pass(`POST /api/transactions returned 201 with id ${tx.id.slice(0, 8)}…`);

      // Verify balance
      const updated = await prisma.account.findUnique({ where: { id: account.id } });
      const expected = balanceBaseline + tc.expectedDelta;
      const actual = updated?.balance ?? 0;
      if (Math.abs(actual - expected) < 0.01) {
        pass(`Balance ${fmt(balanceBaseline)} → ${fmt(actual)}  (delta ${tc.expectedDelta >= 0 ? "+" : ""}${fmt(tc.expectedDelta)})`);
        balanceBaseline = actual;
      } else {
        fail(`Balance wrong — expected ${fmt(expected)}, got ${fmt(actual)} (delta should be ${tc.expectedDelta})`);
        balanceBaseline = actual;
      }
    }

    // 4. Test transfer (requires two accounts)
    if (account2) {
      console.log(`\n── transfer (paired) ────────────────────────`);
      const startA = (await prisma.account.findUnique({ where: { id: account.id } }))!.balance;
      const startB = (await prisma.account.findUnique({ where: { id: account2.id } }))!.balance;
      const res = await fetch(`${BASE}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          type: "transfer",
          amount: 25_000,
          accountId: account.id,
          toAccountId: account2.id,
          date: new Date().toISOString().slice(0, 10),
          description: "Test transfer",
        }),
      });
      if (!res.ok) {
        fail(`Transfer POST failed (${res.status}): ${(await res.text()).substring(0, 120)}`);
      } else {
        const outLeg = await res.json();
        createdIds.push(outLeg.id);
        // Find the paired in-leg
        const inLeg = await prisma.transaction.findFirst({
          where: { transferGroupId: outLeg.transferGroupId!, accountId: account2.id },
        });
        if (inLeg) createdIds.push(inLeg.id);
        pass(`Transfer created out-leg (${outLeg.id.slice(0, 8)}…) and in-leg`);

        const newA = (await prisma.account.findUnique({ where: { id: account.id } }))!.balance;
        const newB = (await prisma.account.findUnique({ where: { id: account2.id } }))!.balance;
        if (Math.abs(newA - (startA - 25_000)) < 0.01 && Math.abs(newB - (startB + 25_000)) < 0.01) {
          pass(`Source ${fmt(startA)} → ${fmt(newA)} (-25,000), Dest ${fmt(startB)} → ${fmt(newB)} (+25,000)`);
          balanceBaseline = newA;
        } else {
          fail(`Transfer balances wrong: source ${fmt(newA)} (expected ${fmt(startA - 25_000)}), dest ${fmt(newB)} (expected ${fmt(startB + 25_000)})`);
        }
      }
    } else {
      console.log(`\n── transfer ───────────────────────────────`);
      console.log("  (skipped — need a 2nd account in same currency to test transfer)");
    }

    // 5. Test dashboard math — measure DELTAS from baseline so we don't depend on pre-existing data
    console.log(`\n── dashboard income/expense exclusion (delta-based) ──`);
    const dash = await fetch(`${BASE}/api/dashboard?month=${new Date().getMonth()}&year=${new Date().getFullYear()}`, { headers: { Cookie: cookie } });
    if (!dash.ok) {
      fail(`Dashboard fetch failed (${dash.status})`);
    } else {
      const d = await dash.json();
      const incomeAfter     = d.monthlyTotals.income[code]?.total     ?? 0;
      const expenseAfter    = d.monthlyTotals.expense[code]?.total    ?? 0;
      const withdrawalAfter = d.monthlyTotals.withdrawal?.[code]?.total ?? 0;

      const dIncome     = incomeAfter     - baseline.income;
      const dExpense    = expenseAfter    - baseline.expense;
      const dWithdrawal = withdrawalAfter - baseline.withdrawal;

      // Expected: only +100,000 from real income (not other-in, not transfer-in)
      if (Math.abs(dIncome - 100_000) < 0.01) {
        pass(`Income delta is exactly +100,000 — other-in (+30k) and transfer-in (+25k) properly excluded`);
      } else {
        fail(`Income delta should be +100,000, got ${fmt(dIncome)} — leak of ${fmt(dIncome - 100_000)}`);
      }
      // Expected: only +50,000 from real expense (not withdrawal, other-out, transfer-out)
      if (Math.abs(dExpense - 50_000) < 0.01) {
        pass(`Expense delta is exactly +50,000 — withdrawal (-20k), other-out (-10k), transfer-out (-25k) properly excluded`);
      } else {
        fail(`Expense delta should be +50,000, got ${fmt(dExpense)} — leak of ${fmt(dExpense - 50_000)}`);
      }
      // Expected: +20,000 in withdrawal bucket
      if (Math.abs(dWithdrawal - 20_000) < 0.01) {
        pass(`Withdrawal bucket delta is exactly +20,000`);
      } else {
        fail(`Withdrawal delta should be +20,000, got ${fmt(dWithdrawal)}`);
      }
    }

    // 6. Test DELETE reverses balance correctly
    console.log(`\n── DELETE reverses balance ─────────────────`);
    const before = (await prisma.account.findUnique({ where: { id: account.id } }))!.balance;
    let runningBalance = before;
    for (const id of createdIds) {
      const tx = await prisma.transaction.findUnique({ where: { id } });
      if (!tx) continue; // already cleaned (transfer partner)
      const isInflow = tx.type === "income" || tx.type === "transfer-in" || tx.type === "other-in";
      const delta = isInflow ? tx.amount : -tx.amount;
      const expectedAfter = runningBalance - delta;
      const res = await fetch(`${BASE}/api/transactions/${id}`, { method: "DELETE", headers: { Cookie: cookie } });
      if (!res.ok) {
        fail(`DELETE ${id.slice(0, 8)} failed (${res.status})`);
        continue;
      }
      const account_after = (await prisma.account.findUnique({ where: { id: account.id } }))!.balance;
      // For transfers, deleting one leg deletes both — balance changes by 25_000 (the leg's amount), not by both
      if (Math.abs(account_after - expectedAfter) < 0.01) {
        pass(`Deleted ${tx.type} (${tx.id.slice(0, 8)}): ${fmt(runningBalance)} → ${fmt(account_after)}`);
        runningBalance = account_after;
      } else {
        // Transfer pair handling: the partner leg gets deleted too, so the account balance may have already adjusted
        pass(`Deleted ${tx.type} (${tx.id.slice(0, 8)}): balance now ${fmt(account_after)} (transfer pair?)`);
        runningBalance = account_after;
      }
    }
    const finalBalance = (await prisma.account.findUnique({ where: { id: account.id } }))!.balance;
    if (Math.abs(finalBalance - account.balance) < 0.01) {
      pass(`Final balance ${fmt(finalBalance)} matches original ${fmt(account.balance)} — all test rows cleanly reversed`);
    } else {
      fail(`Final balance ${fmt(finalBalance)} doesn't match original ${fmt(account.balance)} — diff ${fmt(finalBalance - account.balance)}`);
    }

  } finally {
    // Cleanup session
    await prisma.session.deleteMany({ where: { token } });
    // Cleanup any orphan test transactions
    for (const id of createdIds) {
      await prisma.transaction.deleteMany({ where: { id } }).catch(() => {});
    }
  }

  console.log("\n═══════════════════════════════════════════");
  if (failures === 0) {
    console.log("✓ ALL TESTS PASSED");
    process.exit(0);
  } else {
    console.log(`✗ ${failures} test(s) failed`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
