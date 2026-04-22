import { prisma } from "./db";
import bcrypt from "bcryptjs";

export async function seedCurrenciesAndCategories() {
  // Seed currencies
  const currencies = [
    { code: "LAK", symbol: "₭", name: "Lao Kip" },
    { code: "THB", symbol: "฿", name: "Thai Baht" },
    { code: "USD", symbol: "$", name: "US Dollar" },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }

  // Seed default categories
  const categories = [
    { name: "Salary", type: "income" },
    { name: "Freelance", type: "income" },
    { name: "Investment", type: "income" },
    { name: "Other Income", type: "income" },
    { name: "Food & Dining", type: "expense" },
    { name: "Transport", type: "expense" },
    { name: "Utilities", type: "expense" },
    { name: "Rent", type: "expense" },
    { name: "Health", type: "expense" },
    { name: "Shopping", type: "expense" },
    { name: "Entertainment", type: "expense" },
    { name: "Education", type: "expense" },
    { name: "Travel", type: "expense" },
    { name: "Other Expense", type: "expense" },
    { name: "Transfer", type: "both" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // Seed default admin user if none exists
  const adminExists = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: { username: "admin", name: "Admin", passwordHash, role: "admin" },
    });
  }
}
