import {
  TrendingUp, TrendingDown, ArrowLeftRight,
  Landmark, ArrowUpRight, ArrowDownRight,
  PlusCircle, MinusCircle,
} from "lucide-react";

/**
 * Flat, modern icon for each transaction type. Replaces the old emoji glyphs
 * (💰💸↔️🏧↗️↘️) with consistent lucide icons that respect currentColor for theming.
 */
export function TxTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "income":       return <TrendingUp     className={className} />;
    case "expense":      return <TrendingDown   className={className} />;
    case "transfer":     return <ArrowLeftRight className={className} />;
    case "transfer-out": return <ArrowUpRight   className={className} />;
    case "transfer-in":  return <ArrowDownRight className={className} />;
    case "withdrawal":   return <Landmark       className={className} />;
    case "other-in":     return <PlusCircle     className={className} />;
    case "other-out":    return <MinusCircle    className={className} />;
    default:             return <TrendingDown   className={className} />;
  }
}

/** Background + foreground class tokens used by the icon bubble in lists/cards */
export function txTypeBubbleClass(type: string): string {
  switch (type) {
    case "income":       return "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100";
    case "expense":      return "bg-rose-50 text-rose-600 ring-1 ring-rose-100";
    case "withdrawal":   return "bg-amber-50 text-amber-600 ring-1 ring-amber-100";
    case "transfer-in":  return "bg-sky-50 text-sky-600 ring-1 ring-sky-100";
    case "transfer-out": return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    case "transfer":     return "bg-slate-50 text-slate-500 ring-1 ring-slate-100";
    case "other-in":     return "bg-teal-50 text-teal-600 ring-1 ring-teal-100";
    case "other-out":    return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
    default:             return "bg-slate-50 text-slate-500 ring-1 ring-slate-100";
  }
}
