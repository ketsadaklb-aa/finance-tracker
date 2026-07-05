"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Standalone (no app sidebar/nav): the login screen and public share links.
  // Public visitors must never see the app's menu or structure.
  if (pathname === "/login" || pathname.startsWith("/share")) return <>{children}</>;
  return (
    <>
      <Sidebar />
      {/* pb-24 on mobile leaves room for the fixed bottom nav (h-16 + safe-area) */}
      <main className="md:ml-60 min-h-screen px-4 pt-[72px] pb-24 md:p-8">
        {children}
      </main>
      <MobileNav />
    </>
  );
}
