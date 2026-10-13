"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { teamStyle } from "@/lib/teams";
import { LockIcon } from "./Icons";
import TeamBadge from "./TeamBadge";

export interface FixtureItem {
  id: string;
  number: number | null;
  date: string;
  team1: string;
  team2: string;
  venue: string;
  state: "locked" | "open" | "ready" | "played";
}

type Filter = "all" | "open" | "played" | "later";

function fmtDay(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** The fixture list with filters, a team picker and search. Locked matches stay visible but cannot be opened. */
export default function FixtureBrowser({ matches }: { matches: FixtureItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [team, setTeam] = useState("");
  const [q, setQ] = useState("");

  const teams = useMemo(() => [...new Set(matches.flatMap((m) => [m.team1, m.team2]))].sort(), [matches]);
  const counts = useMemo(
    () => ({
      all: matches.length,
      open: matches.filter((m) => m.state === "open" || m.state === "ready").length,
      played: matches.filter((m) => m.state === "played").length,
      later: matches.filter((m) => m.state === "locked").length,
    }),
    [matches],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return matches.filter((m) => {
      if (filter === "open" && !(m.state === "open" || m.state === "ready")) return false;
      if (filter === "played" && m.state !== "played") return false;
      if (filter === "later" && m.state !== "locked") return false;
      if (team && m.team1 !== team && m.team2 !== team) return false;
      if (needle) {
        const hay = `${m.team1} ${m.team2} ${teamStyle(m.team1).code} ${teamStyle(m.team2).code} ${m.venue} match ${m.number ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [matches, filter, team, q]);

  const days = useMemo(() => {
    const map = new Map<string, FixtureItem[]>();
    for (const m of shown) (map.get(m.date) ?? map.set(m.date, []).get(m.date)!).push(m);
    return [...map.entries()];
  }, [shown]);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open now" },
    { id: "played", label: "Played" },
    { id: "later", label: "Not yet open" },
  ];

  return (
    <section id="fixtures" className="scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">IPL 2026 fixtures</h2>
          <p className="text-sm text-muted">The season is played in order: a match opens once the one before it has its real points entered.</p>
        </div>
        <span className="text-xs text-muted">
          {counts.played} played · {counts.all - counts.played} to go
        </span>
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-3.5">
        <label className="relative flex-1">
          <span className="sr-only">Search matches</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a team, ground or match number" className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30" />
        </label>
        <label>
          <span className="sr-only">Filter by team</span>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30 sm:w-56">
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === f.id ? "bg-navy text-white shadow" : "bg-bg text-muted ring-1 ring-line hover:text-ink"}`}>
              {f.label} <span className={filter === f.id ? "text-gold" : "opacity-70"}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {days.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold">No matches fit those filters</p>
          <p className="mt-1 text-sm text-muted">Try clearing the search or picking another team.</p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTeam("");
              setFilter("all");
            }}
            className="btn-primary mt-4 px-4 py-2 text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map(([day, list]) => (
            <div key={day}>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{fmtDay(day)}</h3>
                <div className="h-px flex-1 bg-line" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((m, i) => (
                  <FixtureCard key={m.id} m={m} delay={Math.min(i, 6) * 50} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FixtureCard({ m, delay }: { m: FixtureItem; delay: number }) {
  const locked = m.state === "locked";
  const inner = (
    <>
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: `linear-gradient(${teamStyle(m.team1).bg}, ${teamStyle(m.team2).bg})` }} />
      <div className="flex items-center justify-between pl-2">
        <span className="text-xs font-bold tracking-wide text-muted">MATCH {m.number ?? "–"}</span>
        <Status state={m.state} />
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pl-2">
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamBadge name={m.team1} size="lg" />
          <span className="text-sm font-bold leading-tight">{m.team1}</span>
        </div>
        <span className="rounded-full bg-bg px-2 py-1 text-[11px] font-extrabold tracking-widest text-muted ring-1 ring-line">VS</span>
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamBadge name={m.team2} size="lg" />
          <span className="text-sm font-bold leading-tight">{m.team2}</span>
        </div>
      </div>
      <p className="mt-4 truncate pl-2 text-center text-xs text-muted">{locked ? `Opens after Match ${(m.number ?? 0) - 1} is played through the app` : m.venue}</p>
    </>
  );
  const style = { ["--d" as string]: `${delay}ms` };
  return locked ? (
    <div className="card anim-up relative block cursor-not-allowed select-none overflow-hidden p-4 opacity-60 grayscale" aria-disabled="true" title="Locked: finish the previous match first" style={style}>
      {inner}
      <LockIcon className="absolute right-3 top-9 h-5 w-5" />
    </div>
  ) : (
    <Link href={`/match/${m.id}`} className="card lift anim-up group relative block overflow-hidden p-4" style={style}>
      {inner}
      <span className="pointer-events-none absolute bottom-3 right-4 translate-x-1 text-lg font-bold text-brand opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">→</span>
    </Link>
  );
}

function Status({ state }: { state: FixtureItem["state"] }) {
  if (state === "played") return <span className="chip bg-good-soft text-good">Points entered</span>;
  if (state === "ready") return <span className="chip bg-gold-soft text-warn">Team ready</span>;
  if (state === "open") return <span className="chip bg-bg text-muted ring-1 ring-line">Not generated</span>;
  return <span className="chip bg-bg text-muted ring-1 ring-line">Locked</span>;
}
