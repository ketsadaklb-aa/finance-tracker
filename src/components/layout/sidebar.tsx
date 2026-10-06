"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, Search, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleGroups, isActivePath, openCommandPalette } from "./nav-config";
import { useUser, initials } from "./user-context";

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
        <Sparkles className="h-4 w-4 text-white" />
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/30" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <h1 className="text-slate-900 font-semibold text-sm leading-tight truncate">Super Personal</h1>
          <p className="text-slate-400 text-[11px] mt-0.5">Tasks · Finance</p>
        </div>
      )}
    </div>
  );
}

function SearchButton({ compact }: { compact?: boolean }) {
  const [mac, setMac] = useState(true);
  useEffect(() => { setMac(/Mac|iPhone|iPad/.test(navigator.platform)); }, []);
  if (compact) {
    return (
      <button
        onClick={openCommandPalette}
        title="Search (⌘K)"
        className="mx-auto w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white/80 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      onClick={openCommandPalette}
      className="w-full flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/60 px-3 h-9 text-sm text-slate-400 hover:text-slate-600 hover:bg-white hover:border-slate-300/80 transition-all shadow-sm shadow-slate-900/[0.02]"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 font-sans">
        {mac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}

function NavLinks({ onNavigate, isAdmin, compact }: { onNavigate?: () => void; isAdmin: boolean; compact?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex-1 py-3 overflow-y-auto space-y-5", compact ? "px-2" : "px-3")}>
      {visibleGroups(isAdmin).map(group => (
        <div key={group.title}>
          {!compact && (
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-[0.14em] px-3 mb-1.5">{group.title}</p>
          )}
          {compact && <div className="h-px bg-slate-200/70 mx-2 mb-2 first:hidden" />}
          <div className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  title={compact ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "nav-link relative flex items-center gap-3 rounded-xl text-sm font-medium group",
                    compact ? "justify-center h-10 w-10 mx-auto" : "px-3 h-9",
                    active
                      ? "bg-white text-slate-900 shadow-sm shadow-slate-900/[0.06] ring-1 ring-slate-200/70"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                  )}
                >
                  {active && !compact && (
                    <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-brand" aria-hidden="true" />
                  )}
                  <Icon className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  )} />
                  {!compact && <span className="truncate">{label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function UserCard({ compact, onLogout }: { compact?: boolean; onLogout: () => void }) {
  const user = useUser();
  const name = user?.name ?? "…";
  const avatar = (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-white text-xs font-semibold flex items-center justify-center ring-2 ring-white shadow-sm shrink-0">
      {user ? initials(name) : ""}
    </div>
  );
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 border-t border-slate-200/60">
        {avatar}
        <button onClick={onLogout} title="Sign out" className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="m-3 mt-0 p-2.5 rounded-2xl bg-white/70 ring-1 ring-slate-200/60 flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="text-slate-900 text-sm font-medium truncate">{name}</p>
        <p className="text-slate-400 text-[11px] capitalize">{user?.role ?? ""}</p>
      </div>
      <button
        onClick={onLogout}
        title="Sign out"
        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useUser();
  const router = useRouter();
  const isAdmin = user?.role === "admin";

  // Listen for bottom-nav "More" button to open the drawer
  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener("openMobileNav", open);
    return () => window.removeEventListener("openMobileNav", open);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      {/* Desktop: floating glass rail */}
      <aside
        className={cn(
          "glass hidden md:flex fixed left-3 top-3 bottom-3 flex-col z-30 rounded-3xl transition-[width] duration-300 ease-[var(--ease-out)]",
          collapsed ? "w-[72px]" : "w-[248px]"
        )}
      >
        <div className={cn("flex items-center pt-4 pb-3", collapsed ? "flex-col gap-3 px-2" : "justify-between px-4")}>
          <Logo compact={collapsed} />
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <div className={collapsed ? "px-2" : "px-3"}>
          <SearchButton compact={collapsed} />
        </div>
        <NavLinks isAdmin={isAdmin} compact={collapsed} />
        <UserCard compact={collapsed} onLogout={handleLogout} />
      </aside>

      {/* Mobile: glass top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <div className="glass h-12 rounded-2xl flex items-center px-2 gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white/80 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0"><Logo /></div>
          <button
            onClick={openCommandPalette}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white/80 transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMobileOpen(false)}>
          <div className="sheet-overlay absolute inset-0 bg-slate-900/30 backdrop-blur-sm" data-state="open" />
          <aside
            className="glass animate-slide-in absolute left-2 top-2 bottom-2 w-72 flex flex-col rounded-3xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white/80" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-3"><SearchButton /></div>
            <NavLinks isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
            <UserCard onLogout={handleLogout} />
          </aside>
        </div>
      )}
    </>
  );
}
