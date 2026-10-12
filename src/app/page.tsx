import Link from "next/link";
import { learningOverview } from "@/lib/service";
import { listIplMatches, matchStatusMap } from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function Home() {
  const [matches, status, overview] = await Promise.all([listIplMatches(), matchStatusMap(), learningOverview()]);
  const entered = matches.filter((m) => status.get(m.id)?.entered).length;
  const next = matches.find((m) => !status.get(m.id)?.entered);
  const last = overview.trend[overview.trend.length - 1];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Your match day, done in a minute</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Pick a match, get a legal Dream11 XI with captain and vice-captain reasoning, then enter the real points afterwards. The agent compares its
              predictions with what actually happened and adjusts its scoring weights.
            </p>
          </div>
          {next && (
            <Link href={`/match/${next.id}`} className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90">
              Next up: {next.team1} v {next.team2} →
            </Link>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Matches played with the agent" value={`${entered} of ${matches.length}`} />
          <Stat label="Scoring weights version" value={`v${overview.weights.version}`} />
          <Stat label="Avg gap, latest match" value={last ? `${last.modelMae.toFixed(1)} pts` : "—"} hint={last ? `baseline ${last.baselineMae.toFixed(1)}` : "no entries yet"} />
          <Stat label="Learning entries" value={String(overview.logs.length)} />
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3 text-sm font-medium">IPL 2026 fixtures</div>
        <ul className="divide-y divide-line">
          {matches.map((m) => {
            const s = status.get(m.id);
            return (
              <li key={m.id}>
                <Link href={`/match/${m.id}`} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-bg sm:grid-cols-[3rem_9rem_1fr_auto]">
                  <span className="text-sm font-medium text-muted">#{m.matchNumber ?? "–"}</span>
                  <span className="hidden text-sm text-muted sm:block">{fmtDate(m.date)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.team1} v {m.team2}</span>
                    <span className="block truncate text-xs text-muted">{m.venue}</span>
                  </span>
                  <Chip s={s} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

function Chip({ s }: { s?: { generated: boolean; entered: boolean } }) {
  if (s?.entered) return <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">Points entered</span>;
  if (s?.generated) return <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn">Team ready</span>;
  return <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line">Not generated</span>;
}
