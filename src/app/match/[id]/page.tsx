import Link from "next/link";
import { notFound } from "next/navigation";
import ActualsForm from "@/components/ActualsForm";
import GenerateButton from "@/components/GenerateButton";
import { LockIcon, ROLE_LABEL, RoleIcon } from "@/components/Icons";
import ScaleStrip from "@/components/ScaleStrip";
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
  const { match, rec, xi, byId, previousLearning, currentWeights, hasActuals } = v;
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

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-muted hover:text-ink">← All matches</Link>

      <section className="hero relative overflow-hidden rounded-3xl text-white shadow-lg">
        <div className="pitch-lines absolute inset-0" />
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: t1.bg }} />
        <div className="absolute inset-y-0 right-0 w-1.5" style={{ background: t2.bg }} />
        <div className="relative px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              Match {match.matchNumber ?? "–"} · {new Date(match.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
            </p>
            {rec && !hasActuals && <GenerateButton matchId={match.id} regenerate />}
          </div>
          <h1 className="sr-only">{match.team1} v {match.team2}</h1>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
              <TeamBadge name={match.team1} size="xl" />
              <div className="text-base font-extrabold leading-tight sm:text-2xl">{match.team1}</div>
            </div>
            <div className="text-center text-xs font-bold tracking-widest text-white/60">VS</div>
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row-reverse sm:gap-4 sm:text-right">
              <TeamBadge name={match.team2} size="xl" />
              <div className="text-base font-extrabold leading-tight sm:text-2xl">{match.team2}</div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-white/80">{match.venueFull} · {toss}</p>
          {hasActuals && match.resultText && (
            <p className="mx-auto mt-3 w-fit rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-navy">
              <strong>Result:</strong> {match.resultText}{match.playerOfMatch ? ` · Player of the match: ${match.playerOfMatch}` : ""}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-warn">
        <strong>Early-season model: not yet proven.</strong> Its picks come from past IPL data and weights that had seen {previousLearning ? previousLearning.observations : 0} entered
        result{previousLearning?.observations === 1 ? "" : "s"} when this was generated (weights v{rec ? rec.weights_version : currentWeights.version}).
        Expect errors until the gap between predicted and actual points shrinks over several matches.
        Credits are estimated, not Dream11&apos;s own, so check the 100-credit total in the Dream11 app. Teams assume the post-toss playing group.
      </section>

      <section className="card p-5">
        <ScaleStrip scale={scale} range={range} compact />
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">What the agent carries forward from earlier matches</h2>
        {previousLearning ? (
          <div className="mt-2 text-sm">
            <p className="text-muted">
              From match {previousLearning.from?.match_number ?? ""} ({previousLearning.from?.team1} v {previousLearning.from?.team2}). Weights apply to every player, so they carry over even when the teams are different.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{(previousLearning.notes as string[]).map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Nothing yet. No earlier match has had its real points entered, so the agent is using its starting weights.</p>
        )}
      </section>

      {!rec && lock.locked && lock.blockedBy ? (
        <section className="card border-dashed p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bg ring-1 ring-line"><LockIcon className="h-8 w-8" /></div>
          <h2 className="mt-3 text-lg font-semibold">This match is locked</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
            The season is played in order. The agent learns from each match before it predicts the next one, so Match {match.matchNumber} opens once Match {lock.blockedBy.matchNumber} ({lock.blockedBy.team1} v {lock.blockedBy.team2}) has been played through the app: generate it, then enter its real points.
          </p>
          <Link href={`/match/${lock.blockedBy.id}`} className="mt-5 inline-block rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-90">Go to Match {lock.blockedBy.matchNumber} →</Link>
        </section>
      ) : !rec ? (
        <section className="card border-dashed p-8 text-center">
          <h2 className="text-lg font-semibold">Ready when you are</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
            The agent will use only data dated before this match: player form, the venue&apos;s history and each player&apos;s record against this opponent. Then it builds the
            highest-scoring legal Dream11 team and explains the captain choices.
          </p>
          <div className="mt-5 flex justify-center"><GenerateButton matchId={match.id} /></div>
        </section>
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-navy px-5 py-3 text-white">
                <h2 className="text-sm font-semibold">Recommended XI</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Pill>Expected total {expectedTotal.toFixed(1)} pts (with C/VC)</Pill>
                  <Pill>{Number(rec.total_credits).toFixed(1)} / {RULES.creditBudget} credits (est.)</Pill>
                  {venue && <Pill>{venue.type}-scoring ground{venue.avgFirstInnings ? ` · avg 1st inns ${venue.avgFirstInnings}` : ""}</Pill>}
                </div>
              </div>
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-bg text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium sm:px-5">Player</th>
                    <th className="px-1 py-2 text-right font-medium sm:px-2">Cr<span className="hidden sm:inline">edits</span> (est.)</th>
                    <th className="px-1 py-2 text-right font-medium sm:px-2">Pred.<span className="hidden sm:inline"> (of {record})</span></th>
                    {hasActuals && <th className="px-1 py-2 text-right font-medium sm:px-2">Actual</th>}
                    {hasActuals && <th className="px-3 py-2 text-right font-medium sm:px-5">Gap</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {xi.map((p) => {
                    const t = teamStyle(p.team);
                    const pct = Math.max(2, Math.min(100, (Number(p.predicted) / record) * 100));
                    return (
                      <tr key={p.player_id}>
                        <td className="px-3 py-2.5 sm:px-5">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full ring-2 ring-white" style={{ background: t.bg }} title={ROLE_LABEL[p.role] ?? p.role}>
                              <RoleIcon role={p.role} className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <span className="font-semibold">{p.name}</span>
                              {p.is_captain && <Tag gold>C</Tag>}
                              {p.is_vice && <Tag>VC</Tag>}
                              <div className="text-[11px] text-muted sm:text-xs">{p.role} · {p.team}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-1 py-2.5 text-right sm:px-2">{Number(p.credit).toFixed(1)}</td>
                        <td className="px-1 py-2.5 text-right sm:px-2">
                          <div className="font-bold">{Number(p.predicted).toFixed(1)}</div>
                          <div className="ml-auto mt-1 h-1.5 w-14 overflow-hidden rounded-full bg-line sm:w-20" title={`${Number(p.predicted).toFixed(1)} of the IPL record ${record}; a typical player-match scores ${scale.median}`}>
                            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        {hasActuals && <td className="px-1 py-2.5 text-right font-bold sm:px-2">{p.actual?.toFixed(1)}</td>}
                        {hasActuals && <td className={`px-3 py-2.5 text-right font-semibold sm:px-5 ${(p.actual ?? 0) - Number(p.predicted) >= 0 ? "text-good" : "text-bad"}`}>{(((p.actual ?? 0) - Number(p.predicted)) >= 0 ? "+" : "") + ((p.actual ?? 0) - Number(p.predicted)).toFixed(1)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
                {hasActuals && actualTotal !== null && (
                  <tfoot>
                    <tr className="border-t-2 border-line bg-bg font-semibold">
                      <td className="px-3 py-2.5 sm:px-5" colSpan={2}>Team total (with C / VC bonus)</td>
                      <td className="px-1 py-2.5 text-right sm:px-2">{expectedTotal.toFixed(1)}</td>
                      <td className="px-1 py-2.5 text-right sm:px-2">{actualTotal.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right sm:px-5">{(actualTotal - expectedTotal >= 0 ? "+" : "") + (actualTotal - expectedTotal).toFixed(1)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
              <p className="border-t border-line px-5 py-2 text-[11px] text-muted">
                Each bar shows the predicted score against the IPL record of {record}. A typical player-match scores {scale.median}, and the best 1% start at {scale.p99}.
              </p>
              <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
                {(rec.checks as any[]).map((c, i) => (
                  <span key={i} title={c.detail} className={`rounded-full px-2.5 py-1 text-xs ${c.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{c.ok ? "✓" : "✗"} {c.rule}</span>
                ))}
              </div>
            </div>

            <aside className="card h-fit p-4 lg:sticky lg:top-24">
              <h2 className="mb-2 text-sm font-semibold">The XI on the ground</h2>
              <XIOnField players={xi.map((p) => ({ name: p.name, role: p.role, team: p.team, isCaptain: p.is_captain, isVice: p.is_vice, predicted: Number(p.predicted) }))} />
              <p className="mt-2 text-center text-[11px] text-muted">Keeper behind the stumps, batters inner ring, all-rounders middle, bowlers on the boundary. C = captain (2x), VC = vice-captain (1.5x).</p>
            </aside>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Card title={`Captain: ${captain?.name ?? ""} (2x)`} body={reasoning?.captain} accent="gold" />
            <Card title={`Vice-captain: ${vice?.name ?? ""} (1.5x)`} body={reasoning?.viceCaptain} accent="brand" />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Card title="This venue and this match" body={`${reasoning?.venueNote ?? ""} ${reasoning?.summary ?? ""}`} />
            <Card title="Main risk" body={reasoning?.risks} foot={`Reasoning by ${rec.used_fallback ? "a templated fallback (Gemini was unavailable)" : rec.model}. Numbers come from the prediction engine, not from Gemini.`} />
          </section>

          <section className="card">
            <div className="border-b border-line px-5 py-3 text-sm font-semibold">Why each player is in</div>
            <ul className="divide-y divide-line">
              {xi.map((p) => (
                <li key={p.player_id} className="px-5 py-2.5 text-sm"><span className="font-semibold">{p.name}</span> <span className="text-muted">— {pickReason.get(p.name) ?? ""}</span></li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="border-b border-line px-5 py-3 text-sm font-semibold">Bench: left out, and why</div>
            <ul className="divide-y divide-line">
              {benchPlayers.map((p) => (
                <li key={p.player_id} className="grid grid-cols-[1fr_auto] gap-3 px-5 py-2.5 text-sm">
                  <div><span className="font-semibold">{p.name}</span> <span className="text-xs text-muted">{p.role} · {p.team}</span><div className="text-muted">{benchReason.get(p.name) ?? detBench.get(p.player_id) ?? ""}</div></div>
                  <span className="text-right text-xs text-muted">{Number(p.predicted).toFixed(1)} pts<br />{Number(p.credit).toFixed(1)} cr</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold">{hasActuals ? "Points entered. Update them if you made a mistake" : "After the match: enter the real points"}</h2>
            <div className="mt-3">
              <ActualsForm
                matchId={match.id}
                rows={xi.map((p) => ({ id: p.player_id, name: p.name, role: p.role, team: p.team, predicted: Number(p.predicted), isCaptain: p.is_captain, isVice: p.is_vice }))}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/10 px-2.5 py-1 font-medium ring-1 ring-white/20">{children}</span>;
}
function Tag({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) {
  return <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${gold ? "bg-gold text-navy" : "bg-navy text-white"}`}>{children}</span>;
}
function Card({ title, body, foot, accent }: { title: string; body?: string; foot?: string; accent?: "gold" | "brand" }) {
  return (
    <div className="card relative overflow-hidden p-5">
      {accent && <div className={`absolute inset-y-0 left-0 w-1.5 ${accent === "gold" ? "bg-gold" : "bg-brand"}`} />}
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed">{body}</p>
      {foot && <p className="mt-3 text-xs text-muted">{foot}</p>}
    </div>
  );
}
