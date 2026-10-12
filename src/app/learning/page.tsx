import Link from "next/link";
import { learningOverview } from "@/lib/service";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function LearningPage() {
  const { trend, logs, weights, defaults } = await learningOverview();
  const f = weights.factors;
  const d = defaults.factors;
  const labels: Record<string, string> = { form: "Recent form", career: "Career average", venue: "Record at this ground", opp: "Record vs this opponent", role: "Role baseline" };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">What the agent has learned</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          After each match, Aryan&apos;s real points are compared with the agent&apos;s predictions. The agent only changes its weights when the evidence is strong enough, and only by small, capped steps.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Current scoring weights (version {weights.version})</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          {Object.keys(f).map((k) => {
            const now = (f as any)[k] as number;
            const start = (d as any)[k] as number;
            const diff = Math.round((now - start) * 100);
            return (
              <div key={k} className="rounded-xl bg-bg p-3">
                <div className="text-xs text-muted">{labels[k]}</div>
                <div className="text-xl font-semibold">{Math.round(now * 100)}%</div>
                <div className="text-xs text-muted">{diff === 0 ? "unchanged from start" : `${diff > 0 ? "+" : ""}${diff} pts vs start (${Math.round(start * 100)}%)`}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Mult title="By player type" entries={weights.roleMult} names={{ WK: "Wicketkeepers", BAT: "Batters", AR: "All-rounders", BOWL: "Bowlers" }} />
          <Mult title="By ground type" entries={weights.venueMult} names={{ high: "High-scoring grounds", mid: "Mid-scoring grounds", low: "Low-scoring grounds" }} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Average gap between predicted and actual points (per player), by match</h2>
        <p className="mt-1 text-xs text-muted">Lower is better. The dashed line is a naive baseline: &quot;each player scores his career average.&quot; The agent should beat it over time, but T20 points are very noisy, so expect wobble.</p>
        {trend.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No matches entered yet. Generate a team, play the match, then enter the real points.</p>
        ) : (
          <>
            <Chart data={trend.map((t) => ({ x: t.seq, a: t.modelMae, b: t.baselineMae }))} />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1.5 font-medium">Match</th><th className="py-1.5 text-right font-medium">Entries</th><th className="py-1.5 text-right font-medium">Agent gap</th><th className="py-1.5 text-right font-medium">Baseline gap</th><th className="py-1.5 text-right font-medium">Over/under-prediction</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {trend.map((t) => (
                    <tr key={t.matchId}>
                      <td className="py-1.5"><Link className="text-brand hover:underline" href={`/match/${t.matchId}`}>#{t.matchNumber ?? "–"} {t.label}</Link></td>
                      <td className="py-1.5 text-right">{t.n}</td>
                      <td className="py-1.5 text-right font-medium">{t.modelMae.toFixed(1)}</td>
                      <td className="py-1.5 text-right">{t.baselineMae.toFixed(1)}</td>
                      <td className="py-1.5 text-right">{t.bias >= 0 ? "+" : ""}{t.bias.toFixed(1)} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3 text-sm font-semibold">Learning log</div>
        {logs.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {logs.map((l: any) => (
              <li key={l.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="font-medium text-brand hover:underline" href={`/match/${l.after_match_id}`}>After match</Link>
                  <span className="text-xs text-muted">{l.observations} entries across {l.matches} match(es) · gap {Number(l.model_mae).toFixed(1)} vs baseline {Number(l.baseline_mae).toFixed(1)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${l.changed ? "bg-brand-soft text-brand" : "bg-bg text-muted ring-1 ring-line"}`}>{l.changed ? `weights v${l.weights_before} → v${l.weights_after}` : "no change"}</span>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted">{(l.notes as string[]).map((n, i) => <li key={i}>{n}</li>)}</ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Mult({ title, entries, names }: { title: string; entries: Record<string, number>; names: Record<string, string> }) {
  return (
    <div className="rounded-xl bg-bg p-3">
      <div className="text-xs text-muted">{title}</div>
      <ul className="mt-1 space-y-0.5">
        {Object.entries(entries).map(([k, v]) => (
          <li key={k} className="flex justify-between"><span>{names[k] ?? k}</span><span className="font-medium">×{v.toFixed(2)}</span></li>
        ))}
      </ul>
    </div>
  );
}

function Chart({ data }: { data: { x: number; a: number; b: number }[] }) {
  const W = 720;
  const H = 200;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const max = Math.max(...data.flatMap((d) => [d.a, d.b])) * 1.15 || 1;
  const x = (i: number) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const line = (k: "a" | "b") => data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Prediction gap per match, agent versus baseline">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(max * t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(max * t)}</text>
        </g>
      ))}
      <path d={line("b")} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" />
      <path d={line("a")} fill="none" stroke="var(--brand)" strokeWidth="2.5" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.a)} r="3.5" fill="var(--brand)" />)}
    </svg>
  );
}
