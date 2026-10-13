import Link from "next/link";
import { notFound } from "next/navigation";
import ActualsForm from "@/components/ActualsForm";
import Collapsible from "@/components/Collapsible";
import CountUp from "@/components/CountUp";
import GenerateButton from "@/components/GenerateButton";
import { LockIcon, RoleIcon } from "@/components/Icons";
import MatchTabs, { type TabSpec } from "@/components/MatchTabs";
import PlayerCard, { type PlayerCardData } from "@/components/PlayerCard";
import ScaleStrip from "@/components/ScaleStrip";
import StepBar from "@/components/StepBar";
import TeamBadge from "@/components/TeamBadge";
import XIOnField from "@/components/XIOnField";
import { RULES } from "@/lib/config";
import { getPointsScale, getPredictionRange } from "@/lib/db";
import { lockStatus, matchView } from "@/lib/service";
import { teamStyle } from "@/lib/teams";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [v, scale, range, lock] = await Promise.all([matchView(id), getPointsScale(), getPredictionRange(), lockStatus(id)]);
  if (!v) notFound();
  const { match, rec, xi, byId, previousLearning, currentWeights, hasActuals, substitutes } = v;
  const record = scale.max.points;
  const reasoning: any = rec?.reasoning;
  const pickReason = new Map<string, string>((reasoning?.picks ?? []).map((p: any) => [p.name, p.reason]));
  const benchReason = new Map<string, string>((reasoning?.benchNotes ?? []).map((p: any) => [p.name, p.reason]));
  const detBench = new Map<string, string>(((rec?.bench as any[]) ?? []).map((b) => [b.playerId, b.reason]));
  const captain = xi.find((p) => p.is_captain);
  const vice = xi.find((p) => p.is_vice);
  const benchPlayers = [...byId.values()].filter((p) => !p.selected).sort((a, b) => Number(b.predicted) - Number(a.predicted));
  const venue: any = rec?.venue_profile;

  const mult = (p: any) => (p.is_captain ? RULES.captainMultiplier : p.is_vice ? RULES.viceCaptainMultiplier : 1);
  const expectedTotal = xi.reduce((a, p) => a + Number(p.predicted) * mult(p), 0);
  const actualTotal = hasActuals ? xi.reduce((a, p) => a + (p.actual ?? 0) * mult(p), 0) : null;
  const toss = match.tossWinner ? `${match.tossWinner} won the toss and chose to ${match.tossDecision}` : "Toss details not available";
  const t1 = teamStyle(match.team1);
  const t2 = teamStyle(match.team2);
  const step = (!rec ? 1 : hasActuals ? 5 : 2) as 1 | 2 | 5;

  const learnedFrom = (
    <Collapsible
      tone="info"
      defaultOpen={!!previousLearning}
      title="What the agent carries forward from earlier matches"
      summary={previousLearning ? `From match ${previousLearning.from?.match_number ?? ""}: ${(previousLearning.notes as string[])[0]?.slice(0, 90)}…` : "Nothing yet: it is using its starting weights."}
      icon={<span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-black text-surface">↻</span>}
    >
      {previousLearning ? (
        <div>
          <p className="text-muted">
            From match {previousLearning.from?.match_number ?? ""} ({previousLearning.from?.team1} v {previousLearning.from?.team2}). Weights apply to every player, so they carry over even when the teams are different.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{(previousLearning.notes as string[]).map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      ) : (
        <p className="text-muted">Nothing yet. No earlier match has had its real points entered, so the agent is using its starting weights.</p>
      )}
    </Collapsible>
  );

  const disclaimer = (
    <Collapsible
      tone="warn"
      title="Early-season model: not yet proven."
      summary={`Weights v${rec ? rec.weights_version : currentWeights.version}. Credits are estimated. Uses each side's 11 starters.`}
      icon={<span className="grid h-8 w-8 place-items-center rounded-full bg-gold text-sm font-black text-navy">!</span>}
    >
      Its picks come from past IPL data and weights that had seen {previousLearning ? previousLearning.observations : 0} entered result{previousLearning?.observations === 1 ? "" : "s"} when this was generated (weights v{rec ? rec.weights_version : currentWeights.version}).
      Expect errors until the gap between predicted and actual points shrinks over several matches. Credits are estimated, not Dream11&apos;s own, so check the 100-credit total in the Dream11 app. Teams use each side&apos;s starting XI (11 a side); the Impact Player rule is out of scope for now.
    </Collapsible>
  );

  // ---------- tab contents ----------
  const cards: PlayerCardData[] = xi.map((p) => ({
    id: p.player_id,
    name: p.name,
    role: p.role,
    team: p.team,
    credit: Number(p.credit),
    predicted: Number(p.predicted),
    isCaptain: p.is_captain,
    isVice: p.is_vice,
    actual: p.actual,
    factors: { form: Number(p.factors?.form ?? 0), career: Number(p.factors?.career ?? 0), venue: Number(p.factors?.venue ?? 0), opp: Number(p.factors?.opp ?? 0), role: Number(p.factors?.role ?? 0) },
    historyMatches: Number(p.history_matches ?? 0),
    reason: pickReason.get(p.name) ?? "",
  }));

  const tabs: TabSpec[] = rec
    ? [
        {
          id: "team",
          label: "Team",
          badge: "11",
          content: (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Expected total" hint="11 players + captain and vice-captain bonus"><CountUp value={expectedTotal} decimals={1} /></Tile>
                <Tile label="Credits used (est.)" hint={`of ${RULES.creditBudget}`}><CountUp value={Number(rec.total_credits)} decimals={1} /></Tile>
                <Tile label="Ground" hint={venue?.avgFirstInnings ? `avg 1st innings ${venue.avgFirstInnings}` : "little history here"}><span className="capitalize">{venue?.type ?? "mid"}-scoring</span></Tile>
                {actualTotal !== null ? (
                  <Tile label="Team total (with C / VC bonus)" hint={`predicted ${expectedTotal.toFixed(1)}`} accent><CountUp value={actualTotal} decimals={1} /> <span className={`text-sm font-bold ${actualTotal - expectedTotal >= 0 ? "text-good" : "text-bad"}`}>{(actualTotal - expectedTotal >= 0 ? "+" : "") + (actualTotal - expectedTotal).toFixed(1)}</span></Tile>
                ) : (
                  <Tile label="Checks" hint="every Dream11 rule"><span className="text-good">{(rec.checks as any[]).filter((c) => c.ok).length}/{(rec.checks as any[]).length} ✓</span></Tile>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-extrabold tracking-tight">Recommended XI</h2>
                    <span className="text-xs text-muted">Tap a player to see why he is in</span>
                  </div>
                  <div className="space-y-2.5">
                    {cards.map((c, i) => (
                      <PlayerCard key={c.id} p={c} record={record} median={scale.median} delay={i * 45} />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(rec.checks as any[]).map((c, i) => (
                      <span key={i} title={c.detail} className={`chip ${c.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{c.ok ? "✓" : "✗"} {c.rule}</span>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Collapsible title="How to read these scores" summary={`Typical player-match: ${scale.median}. IPL record: ${record}. The agent predicts about ${Math.round(range.poolMin)}–${Math.round(range.poolMax)}.`}>
                      <ScaleStrip scale={scale} range={range} compact />
                    </Collapsible>
                  </div>
                </section>
                <aside className="card h-fit p-4 lg:sticky lg:top-44">
                  <h2 className="mb-2 text-sm font-bold">The XI on the ground</h2>
                  <XIOnField players={xi.map((p) => ({ name: p.name, role: p.role, team: p.team, isCaptain: p.is_captain, isVice: p.is_vice, predicted: Number(p.predicted) }))} />
                  <p className="mt-2 text-center text-[11px] text-muted">Keeper behind the stumps, batters inner ring, all-rounders middle, bowlers on the boundary. C = captain (2x), VC = vice-captain (1.5x).</p>
                </aside>
              </div>
            </div>
          ),
        },
        {
          id: "captains",
          label: "Captain & VC",
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <LeaderCard tag="C" title={`Captain: ${captain?.name ?? ""} (2x)`} sub={`${captain?.role} · ${captain?.team}`} points={captain ? Number(captain.predicted) : 0} body={reasoning?.captain} gold />
              <LeaderCard tag="VC" title={`Vice-captain: ${vice?.name ?? ""} (1.5x)`} sub={`${vice?.role} · ${vice?.team}`} points={vice ? Number(vice.predicted) : 0} body={reasoning?.viceCaptain} />
              <p className="text-xs text-muted md:col-span-2">
                Captain and vice-captain are the two highest expected scorers in the XI, which maximises the expected total. Reasoning by {rec.used_fallback ? "a templated fallback (Gemini was unavailable)" : rec.model}; the numbers come from the prediction engine, not from Gemini.
              </p>
            </div>
          ),
        },
        {
          id: "insights",
          label: "Venue & risks",
          content: (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title="This venue and this match" icon="🏟️" body={`${reasoning?.venueNote ?? ""} ${reasoning?.summary ?? ""}`} />
                <InfoCard title="Main risk" icon="⚠️" body={reasoning?.risks} foot={`Reasoning by ${rec.used_fallback ? "a templated fallback (Gemini was unavailable)" : rec.model}. Numbers come from the prediction engine, not from Gemini.`} />
              </div>
              {learnedFrom}
            </div>
          ),
        },
        {
          id: "bench",
          label: "Bench",
          badge: String(benchPlayers.length),
          content: (
            <section className="card overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <h2 className="text-sm font-bold">Bench: left out, and why</h2>
                <p className="text-xs text-muted">Every other starter in this match, with the cost of swapping him in under the budget, team cap and role limits.</p>
              </div>
              <ul className="divide-y divide-line">
                {benchPlayers.map((p) => (
                  <li key={p.player_id} className="flex items-start gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-2">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-2 ring-white/70" style={{ background: teamStyle(p.team).bg }}><RoleIcon role={p.role} className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{p.name}</span> <span className="text-xs text-muted">{p.role} · {p.team}</span>
                      <div className="text-muted">{benchReason.get(p.name) ?? detBench.get(p.player_id) ?? ""}</div>
                    </div>
                    <span className="shrink-0 text-right text-xs text-muted"><span className="block text-sm font-bold text-ink">{Number(p.predicted).toFixed(1)}</span>{Number(p.credit).toFixed(1)} cr</span>
                  </li>
                ))}
              </ul>
            </section>
          ),
        },
        {
          id: "points",
          label: hasActuals ? "Points & result" : "Enter points",
          badge: hasActuals ? "✓" : "to do",
          content: (
            <div className="space-y-4">
              {hasActuals && substitutes.length > 0 && (
                <section className="card overflow-hidden">
                  <div className="border-b border-line px-5 py-3">
                    <h2 className="text-sm font-bold">Impact players who came on (not pickable)</h2>
                    <p className="mt-0.5 text-xs text-muted">The agent only picks from each side&apos;s starting XI, because an Impact Player is not known until he comes on during the match. Shown here for context only; it does not affect learning.</p>
                  </div>
                  <ul className="divide-y divide-line">
                    {substitutes.map((p) => (
                      <li key={p.name + p.team} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                        <span><span className="font-semibold">{p.name}</span> <span className="text-xs text-muted">{p.team}</span><span className="block text-xs text-muted">{p.summary}</span></span>
                        <span className="text-right text-lg font-extrabold">{p.points.toFixed(0)} <span className="text-[11px] font-normal text-muted">pts</span></span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="card p-5">
                <h2 className="text-base font-extrabold">{hasActuals ? "Points entered. Update them if you made a mistake" : "After the match: enter the real points"}</h2>
                <div className="mt-3">
                  <ActualsForm matchId={match.id} rows={xi.map((p) => ({ id: p.player_id, name: p.name, role: p.role, team: p.team, predicted: Number(p.predicted), isCaptain: p.is_captain, isVice: p.is_vice }))} />
                </div>
              </section>
            </div>
          ),
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">← All matches</Link>

      <section className="hero anim-in relative overflow-hidden rounded-3xl shadow-xl">
        <div className="pitch-lines absolute inset-0" />
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: t1.bg }} />
        <div className="absolute inset-y-0 right-0 w-1.5" style={{ background: t2.bg }} />
        <div className="relative px-5 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">
              Match {match.matchNumber ?? "–"} · {new Date(match.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
            </p>
            {rec && !hasActuals && <GenerateButton matchId={match.id} regenerate />}
          </div>
          <h1 className="sr-only">{match.team1} v {match.team2}</h1>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            <div className="anim-up flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
              <TeamBadge name={match.team1} size="xl" />
              <div className="text-base font-black leading-tight sm:text-2xl">{match.team1}</div>
            </div>
            <div className="text-center text-xs font-bold tracking-widest text-white/60">VS</div>
            <div className="anim-up flex flex-col items-center gap-2 text-center sm:flex-row-reverse sm:gap-4 sm:text-right" style={{ ["--d" as string]: "100ms" }}>
              <TeamBadge name={match.team2} size="xl" />
              <div className="text-base font-black leading-tight sm:text-2xl">{match.team2}</div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-white/80">{match.venueFull} · {toss}</p>
          {hasActuals && match.resultText && (
            <p className="btn-gold mx-auto mt-3 w-fit rounded-full px-4 py-1.5 text-sm">
              <strong>Result:</strong> {match.resultText}{match.playerOfMatch ? ` · Player of the match: ${match.playerOfMatch}` : ""}
            </p>
          )}
        </div>
      </section>

      <StepBar current={step === 2 ? 2 : step} />

      {disclaimer}

      {rec ? (
        <MatchTabs tabs={tabs} defaultTab={hasActuals ? "points" : "team"} />
      ) : (
        <>
          {lock.locked && lock.blockedBy ? (
            <section className="card border-dashed p-8 text-center anim-up">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bg ring-1 ring-line"><LockIcon className="h-8 w-8" /></div>
              <h2 className="mt-3 text-lg font-bold">This match is locked</h2>
              <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
                The season is played in order. The agent learns from each match before it predicts the next one, so Match {match.matchNumber} opens once Match {lock.blockedBy.matchNumber} ({lock.blockedBy.team1} v {lock.blockedBy.team2}) has been played through the app: generate it, then enter its real points.
              </p>
              <Link href={`/match/${lock.blockedBy.id}`} className="btn-primary mt-5 inline-block px-5 py-3 text-sm">Go to Match {lock.blockedBy.matchNumber} →</Link>
            </section>
          ) : (
            <section className="card anim-up border-dashed p-8 text-center">
              <h2 className="text-xl font-extrabold">Ready when you are</h2>
              <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
                The agent will use only data dated before this match: player form, the venue&apos;s history and each player&apos;s record against this opponent. Then it builds the highest-scoring legal Dream11 team and explains the captain choices.
              </p>
              <div className="mt-6 flex justify-center"><GenerateButton matchId={match.id} /></div>
            </section>
          )}
          {learnedFrom}
          <div className="card p-5"><ScaleStrip scale={scale} range={range} compact /></div>
        </>
      )}
    </div>
  );
}

function Tile({ label, hint, children, accent = false }: { label: string; hint: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`card anim-up px-4 py-3 ${accent ? "ring-2 ring-gold/50" : ""}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-2xl font-black tabular-nums">{children}</div>
      <div className="text-[11px] text-muted">{hint}</div>
    </div>
  );
}

function LeaderCard({ tag, title, sub, points, body, gold = false }: { tag: string; title: string; sub: string; points: number; body?: string; gold?: boolean }) {
  return (
    <article className="card lift anim-up relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${gold ? "bg-gradient-to-r from-gold to-amber-300" : "bg-gradient-to-r from-brand to-sky-400"}`} />
      <div className="flex items-start gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-black shadow ${gold ? "bg-gold text-navy" : "bg-navy text-white"}`}>{tag}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold leading-tight">{title}</h3>
          <p className="text-xs text-muted">{sub}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums"><CountUp value={points} decimals={1} /></div>
          <div className="text-[10px] uppercase tracking-wide text-muted">expected pts</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{body}</p>
    </article>
  );
}

function InfoCard({ title, icon, body, foot }: { title: string; icon: string; body?: string; foot?: string }) {
  return (
    <article className="card anim-up p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold"><span className="text-lg">{icon}</span>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed">{body}</p>
      {foot && <p className="mt-3 text-xs text-muted">{foot}</p>}
    </article>
  );
}
