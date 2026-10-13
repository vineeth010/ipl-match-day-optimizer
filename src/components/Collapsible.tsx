"use client";

import { useId, useState } from "react";

/**
 * A card with a short always-visible summary that opens smoothly to reveal the full text.
 * The full text is always in the page (just visually collapsed), so nothing is lost for readers or search.
 */
export default function Collapsible({
  title,
  summary,
  icon,
  tone = "plain",
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  summary?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "plain" | "warn" | "info";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const toneCls = tone === "warn" ? "border-gold/40 bg-gold-soft" : tone === "info" ? "border-brand/30 bg-brand-soft" : "border-line bg-surface";
  const titleCls = tone === "warn" ? "text-warn" : "text-ink";
  return (
    <section className={`overflow-hidden rounded-2xl border shadow-sm transition-colors ${toneCls}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:brightness-[0.98] sm:px-5"
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${titleCls}`}>{title}</span>
          {summary && !open && <span className="mt-0.5 block truncate text-xs text-muted">{summary}</span>}
        </span>
        <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      <div id={id} className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open}>
          <div className={`px-4 pb-4 pt-0 text-sm leading-relaxed sm:px-5 ${tone === "warn" ? "text-warn" : ""}`}>{children}</div>
        </div>
      </div>
    </section>
  );
}
