export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { seedCurrenciesAndCategories } from "@/lib/seed";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finance Tracker",
  description: "Personal finance tracking",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

async function init() {
  try {
    await seedCurrenciesAndCategories();
  } catch {
    // already seeded
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await init();
  return (
    <html lang="en">
      <body className={`${geist.className} bg-slate-50 antialiased`}>
        <ToastProvider>
          <Sidebar />
          <main className="md:ml-60 min-h-screen px-4 pt-[72px] pb-8 md:p-8">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
