import {
  LayoutDashboard, ArrowUpDown, Users, BookOpen, Wallet, ListChecks, PenLine, Shield,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean; keywords?: string };
export type NavGroup = { title: string; items: NavItem[] };

/** Single source of truth for the sidebar, mobile drawer, and command palette. */
export const navGroups: NavGroup[] = [
  {
    title: "Finance",
    items: [
      { href: "/",             label: "Dashboard",      icon: LayoutDashboard, adminOnly: true, keywords: "home overview net worth" },
      { href: "/accounts",     label: "Accounts",       icon: Wallet,          adminOnly: true, keywords: "bank cash wallet balance" },
      { href: "/transactions", label: "Transactions",   icon: ArrowUpDown,     adminOnly: true, keywords: "income expense activity" },
      { href: "/ledger",       label: "AR / AP Ledger", icon: BookOpen,        keywords: "receivables payables debt owe" },
      { href: "/contacts",     label: "Contacts",       icon: Users,           adminOnly: true, keywords: "people" },
    ],
  },
  {
    title: "Productivity",
    items: [
      { href: "/tasks", label: "Tasks", icon: ListChecks, keywords: "todo board calendar" },
      { href: "/notes", label: "Notes", icon: PenLine,    keywords: "whiteboard excalidraw draw" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin", label: "Admin", icon: Shield, adminOnly: true, keywords: "users permissions" },
    ],
  },
];

export function visibleGroups(isAdmin: boolean): NavGroup[] {
  return navGroups
    .map(g => ({ ...g, items: g.items.filter(i => isAdmin || !i.adminOnly) }))
    .filter(g => g.items.length > 0);
}

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** Open the add-transaction sheet — directly if we're on /transactions, otherwise navigate there. */
export function openAddTransaction(pathname: string, push: (href: string) => void) {
  if (pathname === "/transactions") window.dispatchEvent(new CustomEvent("openAddTransaction"));
  else push("/transactions?add=1");
}

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("openCommandPalette"));
}
