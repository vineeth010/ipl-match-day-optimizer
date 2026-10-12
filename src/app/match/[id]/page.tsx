import Link from "next/link";
import { notFound } from "next/navigation";
import ActualsForm from "@/components/ActualsForm";
import GenerateButton from "@/components/GenerateButton";
import { RULES } from "@/lib/config";
import { matchView } from "@/lib/service";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await matchView(id);
  if (!v) notFound();
  const { match, rec, xi, byId, previousLearning, currentWeights, hasActuals } = v;
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

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-muted hover:text-ink">← All matches</Link>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted">Match {match.matchNumber ?? "–"} · {new Date(match.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{match.team1} v {match.team2}</h1>
            <p className="mt-1 text-sm text-muted">{match.venueFull} · {toss}</p>
            {hasActuals && match.resultText && <p className="mt-2 text-sm"><strong>Result:</strong> {match.resultText}{match.playerOfMatch ? ` · Player of the match: ${match.playerOfMatch}` : ""}</p>}
          </div>
          {rec && !hasActuals && <GenerateButton matchId={match.id} regenerate />}
        </div>
      </section>

      <section className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
        <strong>Early-season model: not yet proven.</strong> Its picks come from past IPL data and weights that had seen {previousLearning ? previousLearning.observations : 0} entered
        result{previousLearning?.observations === 1 ? "" : "s"} when this was generated (weights v{rec ? rec.weights_version : currentWeights.version}). Expect errors until the gap between predicted and actual points shrinks over several matches.
        Credits are estimated, not Dream11&apos;s own, so check the 100-credit total in the Dream11 app. Teams assume the post-toss playing group.
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
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

      {!rec ? (
        <section className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
          <h2 className="text-lg font-semibold">Ready when you are</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
            The agent will use only data dated before this match: player form, the venue&apos;s history and each player&apos;s record against this opponent. Then it builds the
            highest-scoring legal Dream11 team and explains the captain choices.
          </p>
          <div className="mt-5 flex justify-center"><GenerateButton matchId={match.id} /></div>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold">Recommended XI</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <Pill>Expected total {expectedTotal.toFixed(1)} pts (with C/VC)</Pill>
                <Pill>{Number(rec.total_credits).toFixed(1)} / {RULES.creditBudget} credits (est.)</Pill>
                {venue && <Pill>{venue.type}-scoring ground{venue.avgFirstInnings ? ` · avg 1st inns ${venue.avgFirstInnings}` : ""}</Pill>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr><th className="px-3 py-2 font-medium sm:px-5">Player</th><th className="hidden px-2 py-2 font-medium sm:table-cell">Role</th><th className="px-1 py-2 text-right font-medium sm:px-2">Cr<span className="hidden sm:inline">edits</span> (est.)</th><th className="px-1 py-2 text-right font-medium sm:px-2">Pred.</th>{hasActuals && <th className="px-1 py-2 text-right font-medium sm:px-2">Actual</th>}{hasActuals && <th className="px-3 py-2 text-right font-medium sm:px-5">Gap</th>}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {xi.map((p) => (
                    <tr key={p.player_id}>
                      <td className="px-3 py-2 sm:px-5"><span className="font-medium">{p.name}</span>{p.is_captain && <Tag>C</Tag>}{p.is_vice && <Tag>VC</Tag>}<div className="text-[11px] text-muted sm:text-xs">{p.role} · {p.team}</div></td>
                      <td className="hidden px-2 py-2 text-muted sm:table-cell">{p.role}</td>
                      <td className="px-1 py-2 text-right sm:px-2">{Number(p.credit).toFixed(1)}</td>
                      <td className="px-1 py-2 text-right font-medium sm:px-2">{Number(p.predicted).toFixed(1)}</td>
                      {hasActuals && <td className="px-1 py-2 text-right font-medium sm:px-2">{p.actual?.toFixed(1)}</td>}
                      {hasActuals && <td className={`px-3 py-2 sm:px-5 text-right ${(p.actual ?? 0) - Number(p.predicted) >= 0 ? "text-brand" : "text-bad"}`}>{(((p.actual ?? 0) - Number(p.predicted)) >= 0 ? "+" : "") + ((p.actual ?? 0) - Number(p.predicted)).toFixed(1)}</td>}
                    </tr>
                  ))}
                </tbody>
                {hasActuals && actualTotal !== null && (
                  <tfoot><tr className="border-t border-line bg-bg font-medium"><td className="px-3 py-2 sm:px-5" colSpan={2}>Team total (with C / VC bonus)</td><td className="hidden sm:table-cell"></td><td className="px-1 py-2 text-right sm:px-2">{expectedTotal.toFixed(1)}</td><td className="px-1 py-2 text-right sm:px-2">{actualTotal.toFixed(1)}</td><td className="px-3 py-2 text-right sm:px-5">{(actualTotal - expectedTotal >= 0 ? "+" : "") + (actualTotal - expectedTotal).toFixed(1)}</td></tr></tfoot>
                )}
              </table>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
              {(rec.checks as any[]).map((c, i) => (
                <span key={i} title={c.detail} className={`rounded-full px-2.5 py-1 text-xs ${c.ok ? "bg-brand-soft text-brand" : "bg-bad-soft text-bad"}`}>{c.ok ? "✓" : "✗"} {c.rule}</span>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Card title={`Captain: ${captain?.name ?? ""} (2x)`} body={reasoning?.captain} />
            <Card title={`Vice-captain: ${vice?.name ?? ""} (1.5x)`} body={reasoning?.viceCaptain} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Card title="This venue and this match" body={`${reasoning?.venueNote ?? ""} ${reasoning?.summary ?? ""}`} />
            <Card title="Main risk" body={reasoning?.risks} foot={`Reasoning by ${rec.used_fallback ? "a templated fallback (Gemini was unavailable)" : rec.model}. Numbers come from the prediction engine, not from Gemini.`} />
          </section>

          <section className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-3 text-sm font-semibold">Why each player is in</div>
            <ul className="divide-y divide-line">
              {xi.map((p) => (
                <li key={p.player_id} className="px-5 py-2.5 text-sm"><span className="font-medium">{p.name}</span> <span className="text-muted">— {pickReason.get(p.name) ?? ""}</span></li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-3 text-sm font-semibold">Bench: left out, and why</div>
            <ul className="divide-y divide-line">
              {benchPlayers.map((p) => (
                <li key={p.player_id} className="grid grid-cols-[1fr_auto] gap-3 px-5 py-2.5 text-sm">
                  <div><span className="font-medium">{p.name}</span> <span className="text-xs text-muted">{p.role} · {p.team}</span><div className="text-muted">{benchReason.get(p.name) ?? detBench.get(p.player_id) ?? ""}</div></div>
                  <span className="text-right text-xs text-muted">{Number(p.predicted).toFixed(1)} pts<br />{Number(p.credit).toFixed(1)} cr</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
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
  return <span className="rounded-full bg-bg px-2.5 py-1 font-medium ring-1 ring-line">{children}</span>;
}
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="ml-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">{children}</span>;
}
function Card({ title, body, foot }: { title: string; body?: string; foot?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed">{body}</p>
      {foot && <p className="mt-3 text-xs text-muted">{foot}</p>}
    </div>
  );
}
