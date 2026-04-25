"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ArrowUpDown, Users,
  BookOpen, Wallet, Upload, DollarSign, Menu, X, LogOut, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/",             label: "Dashboard",        icon: LayoutDashboard },
  { href: "/accounts",     label: "Accounts",          icon: Wallet },
  { href: "/transactions", label: "Transactions",      icon: ArrowUpDown },
  { href: "/contacts",     label: "Contacts",          icon: Users },
  { href: "/ledger",       label: "AR / AP Ledger",    icon: BookOpen },
  { href: "/import",       label: "Import Statement",  icon: Upload },
];

const memberNav = [
  { href: "/ledger", label: "AR / AP Ledger", icon: BookOpen },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shrink-0">
        <DollarSign className="h-4 w-4 text-white" />
      </div>
      <div>
        <h1 className="text-white font-bold text-sm leading-none">Catdy's</h1>
        <p className="text-blue-300 text-xs mt-0.5">AR AP Tracker</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  const pathname = usePathname();
  const nav = isAdmin ? adminNav : memberNav;
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest px-3 mb-3">Menu</p>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium group",
              active
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "text-blue-200 hover:bg-white/10 hover:text-white"
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              active ? "bg-white/20" : "bg-white/5 group-hover:bg-white/15"
            )}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span>{label}</span>
            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className={cn(
            "nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium group mt-2",
            pathname === "/admin"
              ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
              : "text-blue-200 hover:bg-white/10 hover:text-white"
          )}
        >
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
            pathname === "/admin" ? "bg-white/20" : "bg-white/5 group-hover:bg-white/15"
          )}>
            <Shield className="h-3.5 w-3.5" />
          </div>
          <span>Admin</span>
          {pathname === "/admin" && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />}
        </Link>
      )}
    </nav>
  );
}

function SidebarFooter({ name, role, onLogout }: { name: string; role: string; onLogout: () => void }) {
  return (
    <div className="px-4 py-4 border-t border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          <p className="text-blue-300 text-xs capitalize">{role}</p>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          className="p-2 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-1.5">
        {["LAK", "THB", "USD"].map(c => (
          <span key={c} className="text-xs text-blue-300 bg-white/5 rounded-md px-2 py-0.5 font-mono">{c}</span>
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d); });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const footer = <SidebarFooter name={user?.name ?? "..."} role={user?.role ?? ""} onLogout={handleLogout} />;
  const isAdmin = user?.role === "admin";

  return (
    <>
      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen flex-col z-30"
        style={{ background: "var(--sidebar)", width: "240px" }}
      >
        <div className="px-6 py-5 border-b border-white/10">
          <Logo />
        </div>
        <NavLinks isAdmin={isAdmin} />
        {footer}
      </aside>

      <header
        className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center px-4 gap-3"
        style={{ background: "var(--sidebar)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo />
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="absolute left-0 top-0 h-screen w-72 flex flex-col"
            style={{ background: "var(--sidebar)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
