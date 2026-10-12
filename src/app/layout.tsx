import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Match Day Optimizer",
  description: "Dream11 match day agent for IPL 2026: a valid XI, captain reasoning, and a loop that learns from Aryan's real points.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-white">M</span>
              <span>Match Day Optimizer</span>
              <span className="hidden rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand sm:inline">IPL 2026</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-bg">Matches</Link>
              <Link href="/learning" className="rounded-md px-3 py-1.5 hover:bg-bg">What it has learned</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted">
          Built for Aryan. Predictions use only data dated before each match; Aryan submits his team in Dream11 himself.
        </footer>
      </body>
    </html>
  );
}
