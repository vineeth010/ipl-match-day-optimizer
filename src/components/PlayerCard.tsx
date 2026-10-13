"use client";

import { useState } from "react";
import { teamStyle } from "@/lib/teams";
import { ROLE_LABEL, RoleIcon } from "./Icons";

export interface PlayerCardData {
  id: string;
  name: string;
  role: string;
  team: string;
  credit: number;
  predicted: number;
  isCaptain: boolean;
  isVice: boolean;
  actual: number | null;
  factors: { form: number; career: number; venue: number; opp: number; role: number };
  historyMatches: number;
  reason: string;
}

const FACTOR_LABELS: { key: keyof PlayerCardData["factors"]; label: string; hint: string }[] = [
  { key: "form", label: "Recent form", hint: "Last five matches, newest weighted most" },
  { key: "career", label: "Career average", hint: "All earlier IPL matches" },
  { key: "venue", label: "At this ground", hint: "Blended with his career average when he has few games here" },
  { key: "opp", label: "Vs this opponent", hint: "Blended with his career average when he has few games against them" },
  { key: "role", label: "Role baseline", hint: "What a typical player in his role scores" },
];

/** One pick as a card. Click to open: the reasons, and the five kinds of evidence behind the prediction. */
export default function PlayerCard({ p, record, median, startOpen = false, delay = 0 }: { p: PlayerCardData; record: number; median: number; startOpen?: boolean; delay?: number }) {
  const [open, setOpen] = useState(startOpen);
  const t = teamStyle(p.team);
  const pct = Math.max(2, Math.min(100, (p.predicted / record) * 100));
  const medianPct = Math.min(100, (median / record) * 100);
  const gap = p.actual === null ? null : p.actual - p.predicted;
  const maxFactor = Math.max(60, ...Object.values(p.factors));
  return (
    <article className="card lift anim-up overflow-hidden" style={{ ["--d" as string]: `${delay}ms` }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left sm:gap-4 sm:px-4">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full ring-2 ring-white/80 shadow" style={{ background: `radial-gradient(circle at 30% 25%, ${t.bg}, ${t.bg} 55%, rgba(0,0,0,.3) 140%)` }} title={ROLE_LABEL[p.role] ?? p.role}>
          <RoleIcon role={p.role} className="h-5 w-5" />
          {(p.isCaptain || p.isVice) && <span className={`absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-extrabold shadow ${p.isCaptain ? "bg-gold text-navy" : "bg-navy text-white ring-1 ring-white/50"}`}>{p.isCaptain ? "C" : "VC"}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold sm:text-base">{p.name}</span>
          <span className="block truncate text-xs text-muted">
            {ROLE_LABEL[p.role] ?? p.role} · {p.team}
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="relative h-1.5 w-full max-w-[11rem] overflow-hidden rounded-full bg-line" title={`${p.predicted.toFixed(1)} of the IPL record ${record}. A typical player-match scores ${median}.`}>
              <span className="anim-grow absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand to-gold" style={{ width: `${pct}%`, ["--d" as string]: `${delay + 150}ms` }} />
              <span className="absolute inset-y-0 w-px bg-ink/40" style={{ left: `${medianPct}%` }} />
            </span>
            <span className="hidden text-[10px] text-muted sm:inline">of {record}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3 sm:gap-5">
          <span className="text-right">
            <span className="block text-[10px] uppercase tracking-wide text-muted">Credits</span>
            <span className="text-sm font-semibold">{p.credit.toFixed(1)}</span>
          </span>
          <span className="text-right">
            <span className="block text-[10px] uppercase tracking-wide text-muted">Predicted</span>
            <span className="text-lg font-extrabold leading-none">{p.predicted.toFixed(1)}</span>
          </span>
          {p.actual !== null && gap !== null && (
            <span className="text-right">
              <span className="block text-[10px] uppercase tracking-wide text-muted">Actual</span>
              <span className="text-lg font-extrabold leading-none">{p.actual.toFixed(1)}</span>
              <span className={`block text-[11px] font-bold ${gap >= 0 ? "text-good" : "text-bad"}`}>{(gap >= 0 ? "+" : "") + gap.toFixed(1)}</span>
            </span>
          )}
          <svg viewBox="0 0 20 20" className={`h-5 w-5 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </span>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open}>
          <div className="space-y-4 border-t border-line bg-surface-2 px-4 pb-4 pt-3.5">
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">Why he is in. </span>
              <span className="text-muted">{p.reason}</span>
            </p>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">What the prediction is built from (expected points from each kind of evidence)</p>
              <ul className="space-y-2">
                {FACTOR_LABELS.map((f) => (
                  <li key={f.key} title={f.hint} className="grid grid-cols-[7.5rem_1fr_2.6rem] items-center gap-2 text-xs sm:grid-cols-[9rem_1fr_3rem]">
                    <span className="truncate text-muted">{f.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-line">
                      <span className="block h-full rounded-full bg-brand/80 transition-[width] duration-700" style={{ width: open ? `${Math.max(3, (p.factors[f.key] / maxFactor) * 100)}%` : "0%" }} />
                    </span>
                    <span className="text-right font-bold tabular-nums">{p.factors[f.key].toFixed(1)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted">
                {p.historyMatches > 0 ? `Built from ${p.historyMatches} earlier IPL match${p.historyMatches === 1 ? "" : "es"}.` : "No earlier IPL history, so the prediction leans on the average for his role, discounted because he is unproven."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
