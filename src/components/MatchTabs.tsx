"use client";

import { useEffect, useRef, useState } from "react";

export interface TabSpec {
  id: string;
  label: string;
  badge?: string;
  content: React.ReactNode;
}

/**
 * Tabs for the match page. Every panel is rendered into the page (inactive ones are only hidden), so all of the text is
 * present for readers, search and tests; switching is instant. The tab is kept in the URL hash so a link can open it.
 */
export default function MatchTabs({ tabs, defaultTab }: { tabs: TabSpec[]; defaultTab: string }) {
  const [active, setActive] = useState(defaultTab);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    if (tabs.some((t) => t.id === fromHash)) setActive(fromHash);
  }, [tabs]);

  function select(id: string) {
    setActive(id);
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
  }

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    select(next.id);
    barRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  }

  return (
    <div>
      <div ref={barRef} role="tablist" aria-label="Match sections" className="sticky top-[118px] z-20 -mx-1 mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/95 p-1 shadow-sm backdrop-blur sm:top-[122px]">
        {tabs.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              data-tab={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${on ? "bg-navy text-white shadow" : "text-muted hover:bg-bg hover:text-ink"}`}
            >
              {t.label}
              {t.badge && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${on ? "bg-gold text-navy" : "bg-bg text-muted ring-1 ring-line"}`}>{t.badge}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={t.id !== active} className={t.id === active ? "anim-up" : ""} style={{ ["--d" as string]: "0ms" }}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
