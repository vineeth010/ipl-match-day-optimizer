import Link from "next/link";
import CountUp from "@/components/CountUp";
import FixtureBrowser, { type FixtureItem } from "@/components/FixtureBrowser";
import HallOfFame from "@/components/HallOfFame";
import { BallIcon, BatIcon, GlovesIcon, StumpsIcon, TrophyIcon } from "@/components/Icons";
import ScaleStrip from "@/components/ScaleStrip";
import TeamBadge from "@/components/TeamBadge";
import { getPointsScale, getPredictionRange, listIplMatches, matchStatusMap } from "@/lib/db";
import { learningOverview } from "@/lib/service";
import { teamStyle } from "@/lib/teams";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: <BatIcon className="h-7 w-7" />, title: "Generate the team", body: "Pick the open match. The agent reads only data dated before it, builds the highest-scoring legal XI (100 credits, 7 per team, role limits) and explains its captain picks." },
  { icon: <GlovesIcon className="h-7 w-7" />, title: "Play it in Dream11", body: "You copy the team into Dream11 yourself. The app never submits anything for you." },
  { icon: <StumpsIcon className="h-7 w-7" />, title: "Enter the real points", body: "After the match, type each player's actual points from the Excel workbook. The yellow cells are exactly what you type." },
  { icon: <TrophyIcon className="h-7 w-7" />, title: "The agent learns", body: "It compares its predictions with reality, nudges its scoring weights in small capped steps, and carries that into the next match." },
];

export default async function Home() {
  const [matches, status, overview, scale, range] = await Promise.all([listIplMatches(), matchStatusMap(), learningOverview(), getPointsScale(), getPredictionRange()]);
  const entered = matches.filter((m) => status.get(m.id)?.entered).length;
  const next = matches.find((m) => !status.get(m.id)?.entered);
  const last = overview.trend[overview.trend.length - 1];

  const fixtures: FixtureItem[] = matches.map((m, i) => {
    const s = status.get(m.id);
    const locked = i > 0 && !status.get(matches[i - 1].id)?.entered;
    return {
      id: m.id,
      number: m.matchNumber,
      date: m.date,
      team1: m.team1,
      team2: m.team2,
      venue: m.venue,
      state: locked ? "locked" : s?.entered ? "played" : s?.generated ? "ready" : "open",
    };
  });

  const tiles: { label: string; node: React.ReactNode; hint: string }[] = [
    { label: "Matches played with the agent", node: <><CountUp value={entered} /><span className="text-xl font-bold text-white/60"> / {matches.length}</span></>, hint: "points entered" },
    { label: "Scoring weights", node: <>v<CountUp value={overview.weights.version} /></>, hint: "learned from your entries" },
    { label: "Avg gap, latest match", node: last ? <><CountUp value={last.modelMae} decimals={1} /><span className="text-xl font-bold text-white/60"> pts</span></> : <>—</>, hint: last ? `baseline ${last.baselineMae.toFixed(1)}` : "no entries yet" },
    { label: "Learning entries", node: <CountUp value={overview.logs.length} />, hint: "times it has learned" },
  ];

  return (
    <div className="space-y-10">
      <section className="hero anim-in relative overflow-hidden rounded-3xl shadow-xl">
        <div className="pitch-lines absolute inset-0" />
        <div className="anim-float absolute -right-14 -top-14 opacity-25"><BallIcon className="h-80 w-80" /></div>
        <div className="absolute bottom-0 right-8 hidden opacity-25 sm:block"><StumpsIcon className="h-44 w-44" /></div>
        <div className="relative px-5 py-9 sm:px-10 sm:py-14">
          <p className="anim-up glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <span className="anim-pulse h-1.5 w-1.5 rounded-full bg-gold" /> IPL 2026 · 74 matches · the season is about to begin
          </p>
          <h1 className="anim-up mt-5 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl" style={{ ["--d" as string]: "80ms" }}>
            Your match day, <span className="text-gradient">done in a minute.</span>
          </h1>
          <p className="anim-up mt-4 max-w-2xl text-sm text-white/80 sm:text-base" style={{ ["--d" as string]: "160ms" }}>
            Pick a match and get a legal Dream11 XI with captain and vice-captain reasoning. After the match, enter the real points and watch the agent compare its predictions with what happened, then adjust its scoring weights.
          </p>
          <div className="anim-up mt-7 flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "240ms" }}>
            {next && (
              <Link href={`/match/${next.id}`} className="btn-gold inline-flex items-center gap-3 px-5 py-3.5 text-sm">
                <TeamBadge name={next.team1} size="sm" /> <span className="opacity-60">v</span> <TeamBadge name={next.team2} size="sm" />
                <span>Next up: {teamStyle(next.team1).code} v {teamStyle(next.team2).code} →</span>
              </Link>
            )}
            <Link href="/points" className="glass rounded-xl px-5 py-3.5 text-sm font-semibold transition hover:bg-white/20">How points work</Link>
            <a href="#fixtures" className="rounded-xl px-3 py-3.5 text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline">Browse fixtures ↓</a>
          </div>
          <dl className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t, i) => (
              <div key={t.label} className="glass anim-up rounded-2xl px-4 py-3.5" style={{ ["--d" as string]: `${320 + i * 70}ms` }}>
                <dt className="text-[11px] uppercase tracking-wide text-white/65">{t.label}</dt>
                <dd className="mt-0.5 text-3xl font-black tabular-nums">{t.node}</dd>
                <div className="text-xs text-white/60">{t.hint}</div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <aside className="anim-up flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3.5 text-sm" role="note">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-black text-surface">i</span>
        <p>
          <strong>How players are counted.</strong> Each match uses the <strong>11 starters of each side (22 players)</strong>. The IPL 2026 <strong>Impact Player</strong> rule is out of scope for now: a substitute is only known once he comes on mid-match, so he is never in the pool. After a match you can see who came on and what they scored, for context only.{" "}
          <Link href="/points#scope" className="font-semibold underline underline-offset-2">Read the full scope</Link>
        </p>
      </aside>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-extrabold tracking-tight">How a match day works</h2>
          <p className="text-sm text-muted">Four steps, repeated for every match in order.</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card lift anim-up relative p-5" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <span className="absolute right-4 top-3 text-5xl font-black text-line">{i + 1}</span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bg ring-1 ring-line">{s.icon}</span>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card anim-up p-5 sm:p-6">
        <ScaleStrip scale={scale} range={range} />
      </section>

      <HallOfFame scale={scale} />

      <FixtureBrowser matches={fixtures} />
    </div>
  );
}
