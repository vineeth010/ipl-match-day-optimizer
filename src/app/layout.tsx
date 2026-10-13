import type { Metadata } from "next";
import Link from "next/link";
import { BallIcon } from "@/components/Icons";
import NavLinks from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Match Day Optimizer",
  description: "Dream11 match day agent for IPL 2026: a valid XI, captain reasoning, and a loop that learns from real points.",
};

// Applies the saved (or system) theme before the first paint so the page never flashes the wrong colours.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('mdo-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/95 text-white shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
            <Link href="/" className="group flex items-center gap-2.5 font-semibold tracking-tight">
              <BallIcon className="h-8 w-8 drop-shadow transition-transform duration-500 group-hover:rotate-[360deg]" />
              <span className="leading-tight">
                Match Day Optimizer
                <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-gold">Dream11 · IPL 2026</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <NavLinks />
              <ThemeToggle />
            </div>
          </div>
          <div className="h-0.5 bg-gradient-to-r from-gold via-white/70 to-gold" />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-10 border-t border-line bg-surface/60">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-xs leading-relaxed text-muted sm:grid-cols-3">
            <div>
              <p className="font-semibold text-ink">Match Day Optimizer</p>
              <p className="mt-1">Built for Aryan. Predictions use only data dated before each match, and Aryan submits his team in Dream11 himself.</p>
            </div>
            <div>
              <p className="font-semibold text-ink">Data</p>
              <p className="mt-1">Scorecards from Cricsheet (cricsheet.org, CC BY 3.0). Roles inferred from history; credits are estimates. Dream11 is never accessed.</p>
            </div>
            <div>
              <p className="font-semibold text-ink">Scope</p>
              <p className="mt-1">11 players a side; the Impact Player rule is out of scope for now. Team colours are our own chips. Not affiliated with Dream11 or the IPL.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
