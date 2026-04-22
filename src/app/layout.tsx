export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/layout/shell";
import { ToastProvider } from "@/components/ui/toast";
import { seedCurrenciesAndCategories } from "@/lib/seed";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Catdy's AR AP Tracker",
  description: "AR AP Tracker",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const g = globalThis as unknown as { _seeded?: boolean };

async function init() {
  if (g._seeded) return;
  try {
    await seedCurrenciesAndCategories();
    g._seeded = true;
  } catch {
    // ignore
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
          <Shell>{children}</Shell>
        </ToastProvider>
      </body>
    </html>
  );
}
