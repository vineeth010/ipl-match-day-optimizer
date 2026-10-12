import type { Metadata } from "next";
import Link from "next/link";
import { BallIcon } from "@/components/Icons";
import "./globals.css";

export const metadata: Metadata = {
  title: "Match Day Optimizer",
  description: "Dream11 match day agent for IPL 2026: a valid XI, captain reasoning, and a loop that learns from real points.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-navy text-white shadow-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <BallIcon className="h-8 w-8 drop-shadow" />
              <span className="leading-tight">
                Match Day Optimizer
                <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-gold">Dream11 · IPL 2026</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-white/10">Matches</Link>
              <Link href="/points" className="rounded-md px-3 py-1.5 hover:bg-white/10">Points guide</Link>
              <Link href="/learning" className="rounded-md px-3 py-1.5 hover:bg-white/10"><span className="hidden sm:inline">What it has </span>learned</Link>
            </nav>
          </div>
          <div className="h-0.5 bg-gradient-to-r from-gold via-white/70 to-gold" />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-8 border-t border-line bg-white/60">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted">
            <p>
              Built for Aryan. Predictions use only data dated before each match, and Aryan submits his team in Dream11 himself. Scorecards from Cricsheet (cricsheet.org, CC BY 3.0). Team colours are our own chips, not club logos. Not affiliated with Dream11 or the IPL.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
