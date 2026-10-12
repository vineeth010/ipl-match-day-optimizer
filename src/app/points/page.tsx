import HallOfFame from "@/components/HallOfFame";
import { BallIcon, BatIcon, GlovesIcon, StumpsIcon } from "@/components/Icons";
import ScaleStrip from "@/components/ScaleStrip";
import { getPointsScale, getPredictionRange } from "@/lib/db";

export const dynamic = "force-dynamic";

const BATTING = [
  ["Each run", "+1"],
  ["Each four (bonus)", "+1"],
  ["Each six (bonus)", "+2"],
  ["30 runs / 50 runs / 100 runs (highest bonus only)", "+4 / +8 / +16"],
  ["Out for a duck (not for bowlers)", "−2"],
  ["Strike rate above 170 / 150 / 130 (min 10 balls, not bowlers)", "+6 / +4 / +2"],
  ["Strike rate 60–70 / 50–60 / below 50", "−2 / −4 / −6"],
];
const BOWLING = [
  ["Each wicket (not run-outs)", "+25"],
  ["Bowled or LBW (bonus)", "+8"],
  ["3 / 4 / 5 wickets in the match", "+4 / +8 / +16"],
  ["Each maiden over", "+12"],
  ["Economy below 5 / 5–6 / 6–7 (min 2 overs)", "+6 / +4 / +2"],
  ["Economy 10–11 / 11–12 / above 12", "−2 / −4 / −6"],
];
const FIELDING = [
  ["Each catch", "+8"],
  ["3 catches (bonus)", "+4"],
  ["Stumping", "+12"],
  ["Run-out, direct hit", "+12"],
  ["Run-out, thrower or catcher", "+6 each"],
  ["Being in the playing XI", "+4"],
  ["Captain / vice-captain", "2x / 1.5x"],
];

export default async function PointsGuide() {
  const [scale, range] = await Promise.all([getPointsScale(), getPredictionRange()]);
  return (
    <div className="space-y-8">
      <section className="hero relative overflow-hidden rounded-3xl px-5 py-8 text-white shadow-lg sm:px-10">
        <div className="pitch-lines absolute inset-0" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Points guide</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">How Dream11 points work, and how high they can go</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/80">Every number in this app is on the same scale: Dream11 points for one player in one match. Here is what that scale looks like, what a prediction means, and whether there is a ceiling.</p>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <ScaleStrip scale={scale} range={range} />
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Lowest ever", String(scale.min)],
            ["Typical (median)", String(scale.median)],
            ["Top 10% start at", String(scale.p90)],
            ["Top 1% start at", String(scale.p99)],
            ["Highest ever", String(scale.max.points)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-bg px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
              <dd className="text-xl font-extrabold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">
          Share of all player-matches above 100: {(scale.share.above100 * 100).toFixed(1)}% · above 150: {(scale.share.above150 * 100).toFixed(2)}% · above 200: {(scale.share.above200 * 100).toFixed(2)}%.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Explain n="1" title="Actual points: no cap, but a practical limit" body={`Dream11 does not cap runs, wickets or catches, so there is no formal maximum. In ${scale.rows.toLocaleString()} IPL player-matches the best was ${scale.max.points}, and half scored ${scale.median} or less. A captain doubles that, which is how contests are won.`} />
        <Explain n="2" title="Predicted points: an average, so far below the peaks" body={`A prediction is a weighted average of a player's past points (form, career, this ground, this opponent, role) with small capped multipliers. It cannot reach peak scores. In back-testing, the agent's predictions ran ${Math.round(range.poolMin)} to ${Math.round(range.poolMax)} per player.`} />
        <Explain n="3" title="A whole team: about 440 to 620 points" body={`11 predictions plus the captain's extra 1x and the vice-captain's extra 0.5x came to ${Math.round(range.teamMin)} to ${Math.round(range.teamMax)} in back-testing, averaging ${Math.round(range.teamMean)}. The agent is judged by how its error behaves match after match, not by predicting peaks.`} />
      </section>

      <HallOfFame scale={scale} />

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">How a player earns points (T20)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Table title="Batting" icon={<BatIcon className="h-5 w-5" />} rows={BATTING} />
          <Table title="Bowling" icon={<BallIcon className="h-5 w-5" />} rows={BOWLING} />
          <Table title="Fielding and extras" icon={<GlovesIcon className="h-5 w-5" />} rows={FIELDING} />
        </div>
        <p className="mt-3 rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-xs leading-relaxed text-warn">
          <StumpsIcon className="mr-1 inline h-4 w-4 align-text-bottom" />
          <strong>What is and is not confirmed.</strong> This table matches two published Dream11 guides (Sportskeeda, psainath.org). Dream11&apos;s own points page could not be reached when we checked, so it is not confirmed against Dream11 itself. Two rules are assumptions: the stumping value (+12) and that the 30, 50 and 100 run bonuses do not stack (only the highest applies).
        </p>
      </section>
    </div>
  );
}

function Explain({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <article className="card p-5">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-sm font-bold text-gold">{n}</span>
      <h3 className="mt-3 font-semibold leading-snug">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}

function Table({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: string[][] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-navy px-4 py-2.5 text-sm font-semibold text-white">{icon}{title}</div>
      <ul className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
            <span>{k}</span>
            <span className="shrink-0 font-bold text-brand">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
