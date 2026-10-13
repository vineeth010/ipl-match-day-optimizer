import Link from "next/link";
import Collapsible from "@/components/Collapsible";
import CountUp from "@/components/CountUp";
import { BallIcon } from "@/components/Icons";
import PickQuality from "@/components/PickQuality";
import TrendChart from "@/components/TrendChart";
import { getPointsScale } from "@/lib/db";
import { learningOverview, pickQuality } from "@/lib/service";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function LearningPage() {
  const [{ trend, logs, weights, defaults }, scale] = await Promise.all([learningOverview(), getPointsScale()]);
  const picks = await pickQuality(scale.median);
  const f = weights.factors;
  const d = defaults.factors;
  const labels: Record<string, string> = { form: "Recent form", career: "Career average", venue: "Record at this ground", opp: "Record vs this opponent", role: "Role baseline" };
  const last = trend[trend.length - 1];
  const byMatch = new Map(trend.map((t) => [t.matchId, t]));

  return (
    <div className="space-y-8">
      <section className="hero anim-in relative overflow-hidden rounded-3xl px-5 py-10 shadow-xl sm:px-10 sm:py-12">
        <div className="pitch-lines absolute inset-0" />
        <div className="anim-float absolute -right-10 -top-10 opacity-20"><BallIcon className="h-64 w-64" /></div>
        <div className="relative">
          <p className="anim-up text-xs font-bold uppercase tracking-[0.16em] text-gold">The learning loop</p>
          <h1 className="anim-up mt-2 text-3xl font-black tracking-tight sm:text-5xl" style={{ ["--d" as string]: "80ms" }}>What the agent has learned</h1>
          <p className="anim-up mt-3 max-w-3xl text-sm text-white/80" style={{ ["--d" as string]: "160ms" }}>
            After each match, Aryan&apos;s real points are compared with the agent&apos;s predictions. The agent only changes its weights when the evidence is strong enough, and only by small, capped steps.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Matches learned from", <CountUp key="a" value={trend.length} />],
              ["Weights version", <>v<CountUp key="b" value={weights.version} /></>],
              ["Latest agent gap", last ? <><CountUp key="c" value={last.modelMae} decimals={1} /> pts</> : "—"],
              ["Latest baseline gap", last ? <><CountUp key="d" value={last.baselineMae} decimals={1} /> pts</> : "—"],
            ].map(([k, v], i) => (
              <div key={String(k)} className="glass anim-up rounded-2xl px-4 py-3" style={{ ["--d" as string]: `${240 + i * 70}ms` }}>
                <dt className="text-[11px] uppercase tracking-wide text-white/65">{k as string}</dt>
                <dd className="mt-0.5 text-2xl font-black tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="card anim-up p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-extrabold tracking-tight">Current scoring weights (version {weights.version})</h2>
          <span className="text-xs text-muted">How much each kind of evidence counts toward a prediction</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {Object.keys(f).map((k) => {
            const now = (f as any)[k] as number;
            const start = (d as any)[k] as number;
            const diff = Math.round((now - start) * 100);
            return (
              <div key={k} className="rounded-2xl bg-bg p-4 ring-1 ring-line transition hover:ring-brand/50">
                <div className="text-xs text-muted">{labels[k]}</div>
                <div className="mt-1 text-3xl font-black tabular-nums"><CountUp value={now * 100} suffix="%" /></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="anim-grow h-full rounded-full bg-gradient-to-r from-brand to-gold" style={{ width: `${Math.min(100, now * 100 * 2)}%` }} />
                </div>
                <div className={`mt-1.5 text-xs font-semibold ${diff === 0 ? "text-muted" : diff > 0 ? "text-good" : "text-bad"}`}>{diff === 0 ? "unchanged from start" : `${diff > 0 ? "▲ +" : "▼ "}${diff} pts vs start (${Math.round(start * 100)}%)`}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Mult title="By player type" entries={weights.roleMult} names={{ WK: "Wicketkeepers", BAT: "Batters", AR: "All-rounders", BOWL: "Bowlers" }} />
          <Mult title="By ground type" entries={weights.venueMult} names={{ high: "High-scoring grounds", mid: "Mid-scoring grounds", low: "Low-scoring grounds" }} />
        </div>
      </section>

      <PickQuality matches={picks} typical={scale.median} />

      <section className="card anim-up p-5 sm:p-6">
        <h2 className="text-lg font-extrabold tracking-tight">Average gap between predicted and actual points, by match</h2>
        <p className="mt-1 text-sm text-muted">Lower is better. The dashed line is a naive baseline: &quot;each player scores his career average.&quot; The agent should beat it over time, but T20 points are very noisy, so expect wobble.</p>
        {trend.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center">
            <p className="font-semibold">No matches entered yet</p>
            <p className="mt-1 text-sm text-muted">Generate a team, play the match, then enter the real points and this chart comes alive.</p>
            <Link href="/" className="btn-primary mt-4 inline-block px-4 py-2 text-sm">Go to the fixtures</Link>
          </div>
        ) : (
          <div className="mt-4">
            <TrendChart data={trend.map((t) => ({ matchId: t.matchId, matchNumber: t.matchNumber, label: t.label, n: t.n, model: t.modelMae, baseline: t.baselineMae, bias: t.bias }))} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1.5 font-medium">Match</th><th className="py-1.5 text-right font-medium">Entries</th><th className="py-1.5 text-right font-medium">Agent gap</th><th className="py-1.5 text-right font-medium">Baseline gap</th><th className="py-1.5 text-right font-medium">Over/under-prediction</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {trend.map((t) => (
                    <tr key={t.matchId} className="transition-colors hover:bg-surface-2">
                      <td className="py-2"><Link className="font-semibold text-brand hover:underline" href={`/match/${t.matchId}`}>#{t.matchNumber ?? "–"} {t.label}</Link></td>
                      <td className="py-2 text-right">{t.n}</td>
                      <td className="py-2 text-right font-bold">{t.modelMae.toFixed(1)}</td>
                      <td className="py-2 text-right">{t.baselineMae.toFixed(1)}</td>
                      <td className="py-2 text-right">{t.bias >= 0 ? "+" : ""}{t.bias.toFixed(1)} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold tracking-tight">Learning log</h2>
        {logs.length === 0 ? (
          <div className="card p-6 text-sm text-muted">Nothing logged yet.</div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((l: any, i: number) => (
              <Collapsible
                key={l.id}
                defaultOpen={i === 0}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <span>After match #{byMatch.get(l.after_match_id)?.matchNumber ?? "–"} {byMatch.get(l.after_match_id)?.label ?? ""}</span>
                    <span className={`chip ${l.changed ? "bg-good-soft text-good" : "bg-bg text-muted ring-1 ring-line"}`}>{l.changed ? `weights v${l.weights_before} → v${l.weights_after}` : "no change"}</span>
                  </span>
                }
                summary={`${l.observations} entries across ${l.matches} match(es) · gap ${Number(l.model_mae).toFixed(1)} vs baseline ${Number(l.baseline_mae).toFixed(1)}`}
              >
                <p className="mb-2 text-xs text-muted">{l.observations} entries across {l.matches} match(es) · gap {Number(l.model_mae).toFixed(1)} vs baseline {Number(l.baseline_mae).toFixed(1)} · <Link className="font-semibold text-brand hover:underline" href={`/match/${l.after_match_id}`}>open the match</Link></p>
                <ul className="list-disc space-y-1 pl-5">{(l.notes as string[]).map((n, j) => <li key={j}>{n}</li>)}</ul>
              </Collapsible>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Mult({ title, entries, names }: { title: string; entries: Record<string, number>; names: Record<string, string> }) {
  return (
    <div className="rounded-2xl bg-bg p-4 ring-1 ring-line">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {Object.entries(entries).map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-3">
            <span>{names[k] ?? k}</span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, ((v - 0.8) / 0.4) * 100)}%` }} /></span>
              <span className="w-12 text-right font-bold tabular-nums">×{v.toFixed(2)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
