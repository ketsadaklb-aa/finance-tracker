import { prisma } from "../src/lib/db";
import { randomBytes } from "crypto";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) { console.error("no admin"); process.exit(1); }
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { userId: admin.id, token, expiresAt: new Date(Date.now() + 3600000) } });
  try {
    const now = new Date();
    const res = await fetch(`http://localhost:3000/api/dashboard?month=${now.getMonth()}&year=${now.getFullYear()}`, {
      headers: { Cookie: `ft_session=${token}; ft_role=admin` },
    });
    const d = await res.json();
    console.log("Has keys:", Object.keys(d).sort().join(", "));
    console.log("\nspendingByCategory (LAK top 5):");
    console.log(JSON.stringify(d.spendingByCategory?.LAK?.slice(0, 5), null, 2));
    console.log("\nhistoricalMonths LAK length:", d.historicalMonths?.LAK?.length);
    console.log("First:", JSON.stringify(d.historicalMonths?.LAK?.[0]));
    console.log("Last:", JSON.stringify(d.historicalMonths?.LAK?.at(-1)));
    console.log("\ndailyTrend LAK length:", d.dailyTrend?.LAK?.length);
    const nonZero = d.dailyTrend?.LAK?.filter((x: { income: number; expense: number }) => x.income > 0 || x.expense > 0);
    console.log("Non-zero days:", JSON.stringify(nonZero));
    console.log("\ntopExpenses count:", d.topExpenses?.length);
    console.log("topExpenses[0]:", JSON.stringify(d.topExpenses?.[0]));
    console.log("\navgDailySpend LAK:", JSON.stringify(d.avgDailySpend?.LAK));
  } finally {
    await prisma.session.delete({ where: { token } });
  }
}
main().catch(e => { console.error(e); process.exit(1); });
