"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Matches", match: (p: string) => p === "/" || p.startsWith("/match") },
  { href: "/points", label: "Points guide", match: (p: string) => p.startsWith("/points") },
  { href: "/learning", label: "Learned", long: "What it has learned", match: (p: string) => p.startsWith("/learning") },
];

export default function NavLinks() {
  const path = usePathname() ?? "/";
  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.map((l) => {
        const active = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-lg px-3 py-1.5 font-medium transition ${active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
          >
            {l.long ? (
              <>
                <span className="hidden sm:inline">{l.long}</span>
                <span className="sm:hidden">{l.label}</span>
              </>
            ) : (
              l.label
            )}
            {active && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gold" />}
          </Link>
        );
      })}
    </nav>
  );
}
