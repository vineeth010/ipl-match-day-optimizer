import Collapsible from "@/components/Collapsible";
import CountUp from "@/components/CountUp";
import HallOfFame from "@/components/HallOfFame";
import { BallIcon, BatIcon, GlovesIcon, StumpsIcon } from "@/components/Icons";
import ScaleStrip from "@/components/ScaleStrip";
import ScoreExplorer from "@/components/ScoreExplorer";
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
    <div className="space-y-10">
      <section className="hero anim-in relative overflow-hidden rounded-3xl px-5 py-10 shadow-xl sm:px-10 sm:py-12">
        <div className="pitch-lines absolute inset-0" />
        <div className="anim-float absolute -right-10 -top-10 opacity-20"><BallIcon className="h-64 w-64" /></div>
        <div className="relative">
          <p className="anim-up text-xs font-bold uppercase tracking-[0.16em] text-gold">Points guide</p>
          <h1 className="anim-up mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl" style={{ ["--d" as string]: "80ms" }}>How Dream11 points work, and <span className="text-gradient">how high they can go</span></h1>
          <p className="anim-up mt-3 max-w-2xl text-sm text-white/80" style={{ ["--d" as string]: "160ms" }}>Every number in this app is on the same scale: Dream11 points for one player in one match. Here is what that scale looks like, what a prediction means, and whether there is a ceiling.</p>
          <nav className="anim-up mt-5 flex flex-wrap gap-2 text-xs font-semibold" style={{ ["--d" as string]: "240ms" }}>
            {[["#explore", "Try a score"], ["#scale", "The scale"], ["#ceiling", "Is there a ceiling?"], ["#earn", "How points are earned"], ["#scope", "Scope & assumptions"]].map(([h, l]) => (
              <a key={h} href={h} className="glass rounded-full px-3 py-1.5 transition hover:bg-white/20">{l}</a>
            ))}
          </nav>
        </div>
      </section>

      <div id="explore" className="scroll-mt-28">
        <ScoreExplorer min={Math.max(0, scale.min)} median={scale.median} p90={scale.p90} p99={scale.p99} record={scale.max.points} predMin={range.poolMin} predMax={range.poolMax} />
      </div>

      <section id="scale" className="card scroll-mt-28 p-5 sm:p-6">
        <ScaleStrip scale={scale} range={range} />
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Lowest ever", scale.min],
            ["Typical (median)", scale.median],
            ["Top 10% start at", scale.p90],
            ["Top 1% start at", scale.p99],
            ["Highest ever", scale.max.points],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-bg px-3 py-3 ring-1 ring-line">
              <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
              <dd className="text-2xl font-black"><CountUp value={v as number} /></dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">
          Share of all player-matches above 100: {(scale.share.above100 * 100).toFixed(1)}% · above 150: {(scale.share.above150 * 100).toFixed(2)}% · above 200: {(scale.share.above200 * 100).toFixed(2)}%.
        </p>
      </section>

      <section id="ceiling" className="scroll-mt-28">
        <h2 className="mb-3 text-xl font-extrabold tracking-tight">Is there a ceiling?</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Explain n="1" title="Actual points: no cap, but a practical limit" body={`Dream11 does not cap runs, wickets or catches, so there is no formal maximum. In ${scale.rows.toLocaleString()} IPL player-matches the best was ${scale.max.points}, and half scored ${scale.median} or less. A captain doubles that, which is how contests are won.`} />
          <Explain n="2" title="Predicted points: an average, so far below the peaks" body={`A prediction is a weighted average of a player's past points (form, career, this ground, this opponent, role) with small capped multipliers. It cannot reach peak scores. In back-testing, the model's predictions ran ${Math.round(range.poolMin)} to ${Math.round(range.poolMax)} per player.`} />
          <Explain n="3" title="A whole team: about 480 to 610 points" body={`11 predictions plus the captain's extra 1x and the vice-captain's extra 0.5x came to ${Math.round(range.teamMin)} to ${Math.round(range.teamMax)} in back-testing, averaging ${Math.round(range.teamMean)}. The system is judged by how its error behaves match after match, not by predicting peaks.`} />
        </div>
      </section>

      <HallOfFame scale={scale} />

      <section id="earn" className="scroll-mt-28">
        <h2 className="mb-3 text-xl font-extrabold tracking-tight">How a player earns points (T20)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Table title="Batting" icon={<BatIcon className="h-5 w-5" />} rows={BATTING} />
          <Table title="Bowling" icon={<BallIcon className="h-5 w-5" />} rows={BOWLING} />
          <Table title="Fielding and extras" icon={<GlovesIcon className="h-5 w-5" />} rows={FIELDING} />
        </div>
      </section>

      <section id="scope" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-extrabold tracking-tight">Scope and assumptions</h2>
        <Collapsible
          tone="warn"
          defaultOpen
          title="What is and is not confirmed"
          icon={<StumpsIcon className="h-7 w-7" />}
          summary="Scoring table, stumping value, bonus stacking, and the 11-a-side scope."
        >
          This table matches two published Dream11 guides (Sportskeeda, psainath.org). Dream11&apos;s own points page could not be reached when we checked, so it is not confirmed against Dream11 itself. Two rules are assumptions: the stumping value (+12) and that the 30, 50 and 100 run bonuses do not stack (only the highest applies). <strong>Scope assumption:</strong> each match uses the 11 starters of each side (22 players). The Impact Player rule is out of scope for now, so substitutes who came on are never in the pool; they are shown after the match for context.
        </Collapsible>
        <Collapsible title="Why the Impact Player is left out" summary="He is only known once he comes on mid-match.">
          Since 2023 each IPL side can bring on one Impact Player during the match. Cricsheet lists him next to the 11 starters, but nobody knows who he will be at the toss, so letting the system pick him would use information from later in the match. Measured on IPL 2026, substitutes scored about 8% of their teams&apos; runs and took about 8% of wickets, and were their side&apos;s top run-scorer in about 1 in 12 sides, so the limitation is real. Supporting him properly would complicate the scope, so it is left for later.
        </Collapsible>
        <Collapsible title="Where the data comes from" summary="Cricsheet ball-by-ball scorecards, loaded once ahead of time.">
          Match data comes from Cricsheet (cricsheet.org, CC BY 3.0), a public ball-by-ball archive, downloaded once and stored with match dates; the app never calls it while in use. Roles are inferred from earlier IPL history (with Gemini classifying first-time players); credits are estimated; Dream11 itself is never accessed.
        </Collapsible>
      </section>
    </div>
  );
}

function Explain({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <article className="card lift anim-up p-5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-sm font-black text-gold">{n}</span>
      <h3 className="mt-3 font-bold leading-snug">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}

function Table({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: string[][] }) {
  return (
    <div className="card lift overflow-hidden">
      <div className="flex items-center gap-2 bg-gradient-to-r from-navy to-navy-2 px-4 py-3 text-sm font-bold text-white">{icon}{title}</div>
      <ul className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-2">
            <span>{k}</span>
            <span className="shrink-0 font-bold text-brand">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
