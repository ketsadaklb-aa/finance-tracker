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
