"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, ArrowUpDown, BookOpen, MoreHorizontal, Plus, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActivePath, openAddTransaction } from "./nav-config";
import { useUser } from "./user-context";

/**
 * Mobile-only floating tab bar. A frosted pill that hovers above the bottom edge,
 * with a gradient "+" in the middle (admins) that opens the add-transaction sheet
 * from any page. Hidden on `md+` (sidebar takes over on desktop).
 */
type Icon = React.ComponentType<{ className?: string }>;

function haptic() {
  if ("vibrate" in navigator) navigator.vibrate(8);
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const [visible, setVisible] = useState(true);

  // Hide when keyboard opens (visual-viewport height shrinks significantly on mobile)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => setVisible(vv.height > window.innerHeight - 100);
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  if (!user) return null;
  const isAdmin = user.role === "admin";

  const openMore = () => {
    haptic();
    window.dispatchEvent(new CustomEvent("openMobileNav"));
  };

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
        "transition-transform duration-300 ease-[var(--ease-out)]",
        visible ? "translate-y-0" : "translate-y-[140%]"
      )}
      aria-label="Mobile navigation"
    >
      <div className={cn("glass rounded-[1.75rem] h-16 px-2 grid items-center", isAdmin ? "grid-cols-5" : "grid-cols-3")}>
        {isAdmin ? (
          <>
            <NavItem href="/" label="Home" Icon={LayoutDashboard} active={isActivePath(pathname, "/")} />
            <NavItem href="/transactions" label="Activity" Icon={ArrowUpDown} active={isActivePath(pathname, "/transactions")} />
            <button
              type="button"
              onClick={() => { haptic(); openAddTransaction(pathname, router.push); }}
              className="flex items-center justify-center tap-feedback"
              aria-label="Add transaction"
            >
              <span className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 ring-1 ring-inset ring-white/30 -translate-y-3 transition-transform active:scale-95">
                <Plus className="h-6 w-6" />
              </span>
            </button>
            <NavItem href="/ledger" label="Ledger" Icon={BookOpen} active={isActivePath(pathname, "/ledger")} />
          </>
        ) : (
          <>
            <NavItem href="/ledger" label="Ledger" Icon={BookOpen} active={isActivePath(pathname, "/ledger")} />
            <NavItem href="/tasks" label="Tasks" Icon={ListChecks} active={isActivePath(pathname, "/tasks")} />
          </>
        )}
        <button
          type="button"
          onClick={openMore}
          className="flex flex-col items-center justify-center gap-0.5 h-12 rounded-2xl tap-feedback text-slate-400 hover:text-slate-700"
          aria-label="Open menu"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}

function NavItem({ href, label, Icon, active }: { href: string; label: string; Icon: Icon; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 h-12 rounded-2xl tap-feedback transition-colors",
        active ? "text-indigo-600" : "text-slate-400 hover:text-slate-700"
      )}
      aria-current={active ? "page" : undefined}
    >
      {active && <span className="absolute inset-x-1.5 inset-y-0.5 rounded-2xl bg-indigo-500/10 animate-scale-in" aria-hidden="true" />}
      <Icon className="relative h-5 w-5" />
      <span className="relative text-[10px] font-semibold">{label}</span>
    </Link>
  );
}
