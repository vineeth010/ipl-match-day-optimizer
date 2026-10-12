import Link from "next/link";
import HallOfFame from "@/components/HallOfFame";
import { BallIcon, LockIcon, StumpsIcon } from "@/components/Icons";
import ScaleStrip from "@/components/ScaleStrip";
import TeamBadge from "@/components/TeamBadge";
import { getPointsScale, getPredictionRange, listIplMatches, matchStatusMap } from "@/lib/db";
import { learningOverview } from "@/lib/service";
import { teamStyle } from "@/lib/teams";

export const dynamic = "force-dynamic";

function fmtDay(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export default async function Home() {
  const [matches, status, overview, scale, range] = await Promise.all([listIplMatches(), matchStatusMap(), learningOverview(), getPointsScale(), getPredictionRange()]);
  const entered = matches.filter((m) => status.get(m.id)?.entered).length;
  const next = matches.find((m) => !status.get(m.id)?.entered);
  const last = overview.trend[overview.trend.length - 1];
  // the season is played in order: a match opens once the one before it has its real points entered
  const locked = new Set<string>();
  matches.forEach((m, i) => {
    if (i > 0 && !status.get(matches[i - 1].id)?.entered) locked.add(m.id);
  });
  const days = new Map<string, typeof matches>();
  for (const m of matches) (days.get(m.date) ?? days.set(m.date, []).get(m.date)!).push(m);

  return (
    <div className="space-y-8">
      <section className="hero relative overflow-hidden rounded-3xl text-white shadow-lg">
        <div className="pitch-lines absolute inset-0" />
        <div className="absolute -right-10 -top-10 opacity-20"><BallIcon className="h-72 w-72 rotate-12" /></div>
        <div className="absolute bottom-0 right-6 hidden opacity-25 sm:block"><StumpsIcon className="h-40 w-40" /></div>
        <div className="relative px-5 py-8 sm:px-10 sm:py-12">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> IPL 2026 · 74 matches · the season is about to begin
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Your match day, <span className="text-gold">done in a minute.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/80 sm:text-base">
            Pick a match and get a legal Dream11 XI with captain and vice-captain reasoning. After the match, enter the real points and watch the agent compare its predictions with what actually happened, then adjust its scoring weights.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {next && (
              <Link href={`/match/${next.id}`} className="inline-flex items-center gap-3 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-navy shadow hover:brightness-105">
                <TeamBadge name={next.team1} size="sm" /> v <TeamBadge name={next.team2} size="sm" />
                <span>Next up: {teamStyle(next.team1).code} v {teamStyle(next.team2).code} →</span>
              </Link>
            )}
            <Link href="/points" className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/15">How points work</Link>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Matches played with the agent", `${entered} of ${matches.length}`, ""],
              ["Scoring weights version", `v${overview.weights.version}`, "learned from your entries"],
              ["Avg gap, latest match", last ? `${last.modelMae.toFixed(1)} pts` : "—", last ? `baseline ${last.baselineMae.toFixed(1)}` : "no entries yet"],
              ["Learning entries", String(overview.logs.length), ""],
            ].map(([k, v, h]) => (
              <div key={k} className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
                <dt className="text-[11px] uppercase tracking-wide text-white/65">{k}</dt>
                <dd className="mt-0.5 text-2xl font-extrabold">{v}</dd>
                {h && <div className="text-xs text-white/65">{h}</div>}
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <ScaleStrip scale={scale} range={range} />
      </section>

      <HallOfFame scale={scale} />

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold tracking-tight">IPL 2026 fixtures</h2>
          <span className="text-xs text-muted">{entered} played · {matches.length - entered} to go</span>
        </div>
        <div className="space-y-5">
          {[...days.entries()].map(([day, list]) => (
            <div key={day}>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{fmtDay(day)}</h3>
                <div className="h-px flex-1 bg-line" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((m) => {
                  const s = status.get(m.id);
                  const isLocked = locked.has(m.id);
                  const inner = (
                    <>
                      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: `linear-gradient(${teamStyle(m.team1).bg}, ${teamStyle(m.team2).bg})` }} />
                      <div className="flex items-center justify-between pl-2">
                        <span className="text-xs font-semibold text-muted">MATCH {m.matchNumber ?? "–"}</span>
                        <Chip s={s} locked={isLocked} />
                      </div>
                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pl-2">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <TeamBadge name={m.team1} size="lg" />
                          <span className="text-sm font-bold leading-tight">{teamStyle(m.team1).short}</span>
                        </div>
                        <span className="rounded-full bg-bg px-2 py-1 text-[11px] font-extrabold tracking-widest text-muted ring-1 ring-line">VS</span>
                        <div className="flex flex-col items-center gap-2 text-center">
                          <TeamBadge name={m.team2} size="lg" />
                          <span className="text-sm font-bold leading-tight">{teamStyle(m.team2).short}</span>
                        </div>
                      </div>
                      <p className="mt-4 truncate pl-2 text-center text-xs text-muted">{isLocked ? `Opens after Match ${(m.matchNumber ?? 0) - 1} is played through the app` : m.venue}</p>
                    </>
                  );
                  return isLocked ? (
                    <div key={m.id} className="card relative block cursor-not-allowed select-none overflow-hidden p-4 opacity-55 grayscale" aria-disabled="true" title="Locked: finish the previous match first">
                      {inner}
                      <LockIcon className="absolute right-3 top-9 h-5 w-5" />
                    </div>
                  ) : (
                    <Link key={m.id} href={`/match/${m.id}`} className="card lift group relative block overflow-hidden p-4">
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Chip({ s, locked = false }: { s?: { generated: boolean; entered: boolean }; locked?: boolean }) {
  if (locked) return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">Locked</span>;
  if (s?.entered) return <span className="rounded-full bg-good-soft px-2.5 py-1 text-[11px] font-semibold text-good">Points entered</span>;
  if (s?.generated) return <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-semibold text-warn">Team ready</span>;
  return <span className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-line">Not generated</span>;
}
