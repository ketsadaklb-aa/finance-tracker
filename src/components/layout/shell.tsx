"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  return (
    <>
      <Sidebar />
      <main className="md:ml-60 min-h-screen px-4 pt-[72px] pb-8 md:p-8">{children}</main>
    </>
  );
}
