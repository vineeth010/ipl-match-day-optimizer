import CountUp from "@/components/CountUp";
import type { PickQualityMatch } from "@/lib/service";

/** "Were the picks any good?": the XI's real total against what was expected, and whether the captain beat his own XI. */
export default function PickQuality({ matches, typical }: { matches: PickQualityMatch[]; typical: number }) {
  const n = matches.length;
  const capWins = matches.filter((m) => m.captainBeatAverage).length;
  const vcWins = matches.filter((m) => m.viceBeatAverage).length;
  const hits = matches.reduce((s, m) => s + m.hits, 0);
  const meanActual = n ? matches.reduce((s, m) => s + m.actual, 0) / n : 0;
  const meanExpected = n ? matches.reduce((s, m) => s + m.expected, 0) / n : 0;

  return (
    <section className="card anim-up p-5 sm:p-6">
      <h2 className="text-lg font-extrabold tracking-tight">Pick quality: were the choices any good?</h2>
      <p className="mt-1 text-sm text-muted">
        This looks at the 11 players the agent picked, not the prediction error. Picking a captain at random from the 11 would beat the team average about half the time, so that is the line to clear. One match proves nothing; the answer only means something over many matches.
      </p>
      {n === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Enter the real points for a match and this fills in.</div>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Captain beat his XI's average", <><CountUp value={capWins} /> of {n}</>, "chance alone: about half"],
              ["Vice-captain beat it", <><CountUp value={vcWins} /> of {n}</>, "chance alone: about half"],
              ["Players at or above a typical score", <><CountUp value={hits} /> of {n * 11}</>, `typical = ${Math.round(typical)} pts`],
              ["Team total: real vs expected", <><CountUp value={meanActual} /> / <CountUp value={meanExpected} /></>, "average per match"],
            ].map(([k, v, s], i) => (
              <div key={i} className="rounded-2xl bg-bg p-4 ring-1 ring-line">
                <dt className="text-xs text-muted">{k as string}</dt>
                <dd className="mt-1 text-2xl font-black tabular-nums">{v}</dd>
                <div className="mt-1 text-[11px] text-muted">{s as string}</div>
              </div>
            ))}
          </dl>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="py-1.5 font-medium">Match</th><th className="py-1.5 font-medium">Captain</th><th className="py-1.5 text-right font-medium">His rank in the XI</th><th className="py-1.5 text-right font-medium">Team total: real</th><th className="py-1.5 text-right font-medium">Expected</th></tr></thead>
              <tbody className="divide-y divide-line">
                {matches.map((m) => (
                  <tr key={m.matchId} className="transition-colors hover:bg-surface-2">
                    <td className="py-2 font-semibold">#{m.matchNumber ?? "–"} {m.label}</td>
                    <td className="py-2">{m.captain} ({m.captainPoints})</td>
                    <td className={`py-2 text-right font-bold ${m.captainBeatAverage ? "text-good" : "text-bad"}`}>{m.captainRank} of 11</td>
                    <td className="py-2 text-right font-bold">{m.actual.toFixed(0)}</td>
                    <td className="py-2 text-right">{m.expected.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
