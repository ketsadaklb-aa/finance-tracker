"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { UserProvider } from "./user-context";

const COLLAPSE_KEY = "ft_sidebar_collapsed";

/** Feed cursor position into the nearest `.spotlight` element for the hover glow. */
function useSpotlight() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".spotlight") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useSpotlight();

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch {}
  }, []);

  // Expose the rail's footprint so full-bleed views (e.g. the Notes canvas) can sit beside it
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-offset", collapsed ? "96px" : "272px");
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch {}
      return !c;
    });
  }

  // Standalone (no app sidebar/nav): the login screen and public share links.
  // Public visitors must never see the app's menu or structure.
  if (pathname === "/login" || pathname.startsWith("/share")) return <>{children}</>;
  return (
    <UserProvider>
      <div className="aurora" aria-hidden="true" />
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      {/* pb-28 on mobile leaves room for the floating tab bar (h-16 + gap + safe-area) */}
      <main
        className={cn(
          "min-h-screen px-4 pt-[76px] pb-28 md:pt-8 md:pb-10 md:pr-8 transition-[padding] duration-300 ease-[var(--ease-out)]",
          collapsed ? "md:pl-[112px]" : "md:pl-[288px]"
        )}
      >
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>
      <MobileNav />
      <CommandPalette />
    </UserProvider>
  );
}
