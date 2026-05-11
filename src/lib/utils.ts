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
export type TxType =
  | "income" | "expense" | "transfer" | "withdrawal"
  | "other-in" | "other-out"; // money that's not really income/expense — refunds, asset sales, holding for someone

export const TX_TYPES: { value: TxType; label: string }[] = [
  { value: "income",     label: "Income"     },
  { value: "expense",    label: "Expense"    },
  { value: "transfer",   label: "Transfer"   },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "other-in",   label: "Other In"   },
  { value: "other-out",  label: "Other Out"  },
];

// Including the two transfer legs that the backend persists
const ALL_TYPE_META: Record<string, { label: string }> = {
  "income":       { label: "Income"       },
  "expense":      { label: "Expense"      },
  "transfer":     { label: "Transfer"     },
  "transfer-out": { label: "Transfer out" },
  "transfer-in":  { label: "Transfer in"  },
  "withdrawal":   { label: "Withdrawal"   },
  "other-in":     { label: "Other In"     },
  "other-out":    { label: "Other Out"    },
};

export function txTypeMeta(type: string) {
  return ALL_TYPE_META[type] ?? { label: type };
}

/** Returns true when this type affects account balance positively */
export function txIncreasesBalance(type: string): boolean {
  return type === "income" || type === "transfer-in" || type === "other-in";
}

/** Returns true when this type counts as "real income" for reports (excludes other-in) */
export function txIsRealIncome(type: string): boolean {
  return type === "income";
}

/** Returns true when this type counts as "real spending" for reports (excludes other-out, withdrawal, transfers) */
export function txIsRealExpense(type: string): boolean {
  return type === "expense";
}

export function txAmountClass(type: string): string {
  switch (type) {
    case "income":       return "text-green-600";
    case "transfer-in":  return "text-blue-600";
    case "expense":      return "text-red-500";
    case "withdrawal":   return "text-amber-600";
    case "transfer-out": return "text-slate-600";
    case "transfer":     return "text-slate-500";
    case "other-in":     return "text-teal-600";
    case "other-out":    return "text-slate-500";
    default:             return "text-slate-500";
  }
}

export function txAmountPrefix(type: string): string {
  if (type === "income" || type === "transfer-in" || type === "other-in") return "+";
  if (type === "expense" || type === "withdrawal" || type === "transfer-out" || type === "other-out") return "-";
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
