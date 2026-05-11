"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, ArrowUpDown, BookOpen, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile-only bottom navigation. Sits at the bottom of the viewport,
 * 5 items with the middle "+" as a floating quick-add button.
 * Hidden on `md+` (sidebar takes over on desktop).
 *
 * The center + button dispatches a window CustomEvent("openAddTransaction")
 * which the transactions page (or any page that wants to listen) handles.
 */
type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; isFab?: boolean; isMore?: boolean };
const items: Item[] = [
  { href: "/",             label: "Home",      icon: LayoutDashboard },
  { href: "/transactions", label: "Activity",  icon: ArrowUpDown     },
  { href: "__add__",       label: "Add",       icon: Plus, isFab: true },
  { href: "/ledger",       label: "Ledger",    icon: BookOpen        },
  { href: "__more__",      label: "More",      icon: MoreHorizontal, isMore: true },
];

export function MobileNav() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setIsAdmin(d.role === "admin"); })
      .catch(() => {});
  }, []);

  // Hide when keyboard opens (visual-viewport height shrinks significantly on mobile)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => setVisible(vv.height > window.innerHeight - 100);
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  if (isAdmin === null) return null;

  const openMore = () => {
    if ("vibrate" in navigator) navigator.vibrate(8);
    window.dispatchEvent(new CustomEvent("openMobileNav"));
  };

  // For non-admin users, only show Ledger + More
  if (!isAdmin) {
    return (
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200",
          "pb-[env(safe-area-inset-bottom)] transition-transform duration-200",
          visible ? "translate-y-0" : "translate-y-full"
        )}
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-2">
          <NavItem href="/ledger" label="Ledger" Icon={BookOpen} active={pathname === "/ledger"} />
          <button onClick={openMore} className="flex flex-col items-center justify-center py-2.5 gap-0.5 tap-feedback text-slate-400 hover:text-slate-700" aria-label="Open menu">
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200",
        "pb-[env(safe-area-inset-bottom)] transition-transform duration-200",
        visible ? "translate-y-0" : "translate-y-full"
      )}
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 items-end">
        {items.map(({ href, label, icon: Icon, isFab, isMore }) => {
          if (isFab) {
            return (
              <button
                key="fab"
                type="button"
                onClick={() => {
                  if ("vibrate" in navigator) navigator.vibrate(8);
                  window.dispatchEvent(new CustomEvent("openAddTransaction"));
                }}
                className="flex flex-col items-center justify-center pb-1 -mt-5 tap-feedback"
                aria-label="Add transaction"
              >
                <span className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 ring-4 ring-white">
                  <Plus className="h-6 w-6" />
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">{label}</span>
              </button>
            );
          }
          if (isMore) {
            return (
              <button
                key="more"
                type="button"
                onClick={openMore}
                className="flex flex-col items-center justify-center py-2.5 gap-0.5 tap-feedback text-slate-400 hover:text-slate-700"
                aria-label="Open menu"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          }
          return <NavItem key={href} href={href} label={label} Icon={Icon} active={pathname === href} />;
        })}
      </div>
    </nav>
  );
}

function NavItem({
  href, label, Icon, active,
}: { href: string; label: string; Icon: React.ComponentType<{ className?: string }>; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center py-2.5 gap-0.5 tap-feedback transition-colors",
        active ? "text-blue-600" : "text-slate-400 hover:text-slate-700"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
