import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "text-red-600 bg-red-50";
    case "partial":
      return "text-yellow-600 bg-yellow-50";
    case "settled":
      return "text-green-600 bg-green-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

// ─── Transaction type helpers ─────────────────────────────────────────────
export type TxType = "income" | "expense" | "transfer" | "withdrawal";

export const TX_TYPES: { value: TxType; label: string; emoji: string }[] = [
  { value: "income",     label: "Income",     emoji: "💰" },
  { value: "expense",    label: "Expense",    emoji: "💸" },
  { value: "transfer",   label: "Transfer",   emoji: "↔️" },
  { value: "withdrawal", label: "Withdrawal", emoji: "🏧" },
];

export function txTypeMeta(type: string) {
  return TX_TYPES.find(t => t.value === type) ?? { value: type as TxType, label: type, emoji: "•" };
}

export function txAmountClass(type: string): string {
  switch (type) {
    case "income":     return "text-green-600";
    case "expense":    return "text-red-500";
    case "withdrawal": return "text-amber-600";
    case "transfer":   return "text-slate-500";
    default:           return "text-slate-500";
  }
}

export function txAmountPrefix(type: string): string {
  if (type === "income") return "+";
  if (type === "expense" || type === "withdrawal") return "-";
  return "";
}

// Friendly relative-date label for transaction lists ("Today", "Yesterday", "Mon", "May 3")
export function relativeDayLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return target.toLocaleDateString("en-US", { weekday: "long" });
  if (target.getFullYear() === today.getFullYear()) {
    return target.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }
  return target.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function getAgingLabel(dueDate: Date | string | null): string {
  if (!dueDate) return "";
  const days = Math.floor(
    (new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return `Due in ${Math.abs(days)}d`;
  if (days === 0) return "Due today";
  if (days <= 30) return `${days}d overdue`;
  if (days <= 60) return "30d+ overdue";
  if (days <= 90) return "60d+ overdue";
  return "90d+ overdue";
}
