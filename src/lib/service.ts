import { DEFAULT_WEIGHTS } from "./config";
import {
  db,
  getActuals,
  getLatestWeights,
  getMatch,
  getPredictions,
  getRecommendation,
  listIplMatches,
  learningBefore,
  listLearningLog,
  loadEvidence,
  loadObservations,
  loadPickRows,
  playerNames,
  saveWeights,
} from "./db";
import { predictPool } from "./engine";
import { explainTeam } from "./gemini";
import { accuracyByMatch, learnFromObservations } from "./learning";
import { buildBestTeam, explainBench, validateTeam } from "./optimizer";
import { summarise } from "./scale";
import type { PlayerPrediction } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * The season is played in order. A match opens only once the match before it has been played through the app,
 * meaning its real points were entered, because the agent needs what it learned from that match.
 */
export async function lockStatus(matchId: string): Promise<{ locked: boolean; blockedBy: { id: string; matchNumber: number | null; team1: string; team2: string } | null }> {
  const matches = await listIplMatches();
  const i = matches.findIndex((m) => m.id === matchId);
  if (i <= 0) return { locked: false, blockedBy: null };
  const prev = matches[i - 1];
  const entered = (await getActuals(prev.id)).length > 0;
  return { locked: !entered, blockedBy: entered ? null : { id: prev.id, matchNumber: prev.matchNumber, team1: prev.team1, team2: prev.team2 } };
}

/** Evidence -> prediction -> legal team -> Gemini reasoning -> saved predictions. */
export async function generateForMatch(matchId: string) {
  const match = await getMatch(matchId);
  if (!match) throw new HttpError(404, "Match not found");
  if (!match.isIpl2026) throw new HttpError(400, "Only IPL 2026 matches can be generated");
  if ((await getActuals(matchId)).length) throw new HttpError(409, "Actual points are already entered for this match, so its recommendation is locked.");

  const lock = await lockStatus(matchId);
  if (lock.locked && lock.blockedBy) {
    throw new HttpError(423, `Match ${match.matchNumber} is locked. Finish Match ${lock.blockedBy.matchNumber} (${lock.blockedBy.team1} v ${lock.blockedBy.team2}) first: generate it and enter its real points.`);
  }

  const weights = await getLatestWeights();
  const evidence = await loadEvidence(match, weights); // date-gated inside
  const { predictions, venue } = predictPool({ ...evidence, weights });
  const team = buildBestTeam(predictions);
  if (!team) throw new HttpError(422, "No legal Dream11 team could be built from this match's players (role data too thin).");
  const checks = validateTeam(team);
  if (checks.some((c) => !c.ok)) throw new HttpError(500, `Team failed validation: ${checks.filter((c) => !c.ok).map((c) => c.rule).join(", ")}`);

  const bench = explainBench(predictions, team);
  const ai = await explainTeam({ match, venue, team, bench, weightsVersion: weights.version });

  const selected = new Set(team.players.map((p) => p.playerId));
  const f = weights.factors;
  const predRows = predictions.map((p) => ({
    match_id: matchId,
    player_id: p.playerId,
    weights_version: weights.version,
    team: p.team,
    role: p.role,
    role_source: p.roleSource,
    credit: p.credit,
    credit_source: p.creditSource,
    predicted: p.predicted,
    base_predicted: baseOf(p, f),
    venue_type: venue.type,
    factors: p.factors,
    selected: selected.has(p.playerId),
    is_captain: p.playerId === team.captain.playerId,
    is_vice: p.playerId === team.viceCaptain.playerId,
    history_matches: p.matchesOfHistory,
  }));
  // upsert (not delete + insert) so two simultaneous requests can never leave the match with an empty or half-written set
  const ins = await db().from("md_predictions").upsert(predRows, { onConflict: "match_id,player_id" });
  if (ins.error) throw new Error(`save predictions: ${ins.error.message}`);

  const rec = await db().from("md_recommendations").upsert(
    {
      match_id: matchId,
      weights_version: weights.version,
      generated_at: new Date().toISOString(),
      data_cutoff_seq: match.seq,
      venue_profile: venue,
      team: team.players.map((p) => ({ playerId: p.playerId, name: p.name })),
      captain_id: team.captain.playerId,
      vice_id: team.viceCaptain.playerId,
      expected_total: team.expectedTotal,
      total_credits: team.totalCredits,
      checks,
      bench: bench.map((b) => ({ playerId: b.player.playerId, reason: b.reason })),
      reasoning: ai.reasoning,
      used_fallback: ai.usedFallback,
      model: ai.model,
    },
    { onConflict: "match_id" },
  );
  if (rec.error) throw new Error(`save recommendation: ${rec.error.message}`);
  return { usedFallback: ai.usedFallback, aiError: ai.error };
}

function baseOf(p: PlayerPrediction, f: { form: number; career: number; venue: number; opp: number; role: number }) {
  return f.form * p.factors.form + f.career * p.factors.career + f.venue * p.factors.venue + f.opp * p.factors.opp + f.role * p.factors.role;
}

/** Everything the match page needs. */
export async function matchView(matchId: string) {
  const match = await getMatch(matchId);
  if (!match) return null;
  const [rec, preds, actuals, previousLearning, weights] = await Promise.all([getRecommendation(matchId), getPredictions(matchId), getActuals(matchId), learningBefore(match.seq), getLatestWeights()]);
  const names = await playerNames(preds.map((p) => p.player_id));
  const byId = new Map(preds.map((p) => [p.player_id, { ...p, name: names.get(p.player_id) ?? p.player_id }]));
  const actualBy = new Map(actuals.map((a) => [a.player_id, Number(a.actual_points)]));
  const xi = preds.filter((p) => p.selected).map((p) => ({ ...byId.get(p.player_id)!, actual: actualBy.get(p.player_id) ?? null }));
  xi.sort((a, b) => Number(b.predicted) - Number(a.predicted));
  // Impact Players who came on: out of scope for picking, shown only after the match as context
  const hasActualsNow = actuals.length > 0;
  let substitutes: { name: string; team: string; points: number; summary: string }[] = [];
  if (hasActualsNow) {
    const meta = ((await db().from("md_meta").select("value").eq("key", "impact_players").maybeSingle()).data as any)?.value ?? {};
    const subRows = ((meta[matchId] ?? []) as { playerId: string; team: string }[]).map((x) => ({ player_id: x.playerId, team: x.team }));
    if (subRows.length) {
      const ids = subRows.map((r) => r.player_id);
      const stats = ((await db().from("md_player_stats").select("player_id,d11,runs,balls,wickets,catches,stumpings").eq("match_id", matchId).in("player_id", ids)).data ?? []) as any[];
      const subNames = await playerNames(ids);
      substitutes = stats
        .map((r) => ({ name: subNames.get(r.player_id) ?? r.player_id, team: subRows.find((x) => x.player_id === r.player_id)?.team ?? "", points: Number(r.d11), summary: summarise(r) }))
        .sort((a, b) => b.points - a.points);
    }
  }
  return { match, rec, xi, byId, previousLearning, currentWeights: weights, hasActuals: hasActualsNow, substitutes };
}

/** Aryan has typed in the real points: save them, then run the learning loop. */
export async function saveActualsAndLearn(matchId: string, points: Record<string, number>) {
  const match = await getMatch(matchId);
  if (!match) throw new HttpError(404, "Match not found");
  const preds = (await getPredictions(matchId)).filter((p) => p.selected);
  if (preds.length !== 11) throw new HttpError(409, "Generate the recommendation for this match first.");
  const ids = preds.map((p) => p.player_id);
  const rows = [];
  for (const id of ids) {
    const v = points[id];
    if (typeof v !== "number" || !Number.isFinite(v) || v < -50 || v > 400) throw new HttpError(400, "Enter a points value between -50 and 400 for all 11 players.");
    rows.push({ match_id: matchId, player_id: id, actual_points: v });
  }
  const existing = await getActuals(matchId);
  const current = await getLatestWeights();
  const unchanged = existing.length === 11 && rows.every((r) => Number(existing.find((e) => e.player_id === r.player_id)?.actual_points) === r.actual_points);
  if (unchanged) {
    // identical points arrived again: there is no new information, so nothing is re-learned and nothing drifts
    const obs = await loadObservations();
    const same = learnFromObservations(current, obs);
    return { ...same, changed: false, after: current, notes: ["These are the same points already saved for this match, so nothing was re-learned and the weights are unchanged."] };
  }

  const up = await db().from("md_actuals").upsert(rows, { onConflict: "match_id,player_id" });
  if (up.error) throw new Error(`save actuals: ${up.error.message}`);

  const observations = await loadObservations();
  // Correcting the match that was learned from most recently: re-learn from the weights that existed BEFORE it,
  // not on top of its own earlier learning, so a correction cannot compound.
  const latestLog = (await listLearningLog(1))[0];
  const isCorrection = latestLog?.after_match_id === matchId;
  let base = current;
  if (isCorrection) {
    const w = (await db().from("md_weights").select("*").eq("version", latestLog.weights_before).maybeSingle()).data as any;
    if (w) base = { version: w.version, factors: w.factors, roleMult: w.role_mult, venueMult: w.venue_mult, note: w.note ?? undefined };
  }
  const result = learnFromObservations(base, observations);
  const needsNewVersion = result.changed || base.version !== current.version;
  if (needsNewVersion) {
    result.after = { ...result.after, version: current.version + 1, note: isCorrection ? "Re-learned after a correction to the latest match" : result.after.note };
    result.changed = true;
    await saveWeights(result.after);
  }
  if (isCorrection) result.notes.unshift("Points for this match were corrected, so the agent re-learned from the weights it had before this match.");
  const log = await db().from("md_learning_log").insert({
    after_match_id: matchId,
    weights_before: current.version,
    weights_after: result.after.version,
    changed: result.changed,
    observations: result.observations,
    matches: result.matches,
    model_mae: result.modelMae,
    baseline_mae: result.baselineMae,
    factor_mae: result.factorMae,
    buckets: result.buckets,
    notes: result.notes,
  });
  if (log.error) throw new Error(`learning log: ${log.error.message}`);
  return result;
}

export async function learningOverview() {
  const [obs, logs] = await Promise.all([loadObservations(), listLearningLog(100)]);
  const raw = accuracyByMatch(obs);
  const ids = raw.map((t) => t.matchId);
  const ms = ids.length ? ((await db().from("md_matches").select("id, match_number, team1, team2").in("id", ids)).data ?? []) : [];
  const info = new Map((ms as any[]).map((m) => [m.id, m]));
  const trend = raw.map((t) => ({ ...t, matchNumber: info.get(t.matchId)?.match_number ?? null, label: info.get(t.matchId) ? `${info.get(t.matchId).team1} v ${info.get(t.matchId).team2}` : t.matchId }));
  return { trend, logs, weights: await getLatestWeights(), defaults: DEFAULT_WEIGHTS };
}

export interface PickQualityMatch {
  matchId: string;
  matchNumber: number | null;
  label: string;
  expected: number; // predicted XI total with captain 2x and vice-captain 1.5x
  actual: number; // real XI total with the same multipliers
  captain: string;
  captainPoints: number;
  captainRank: number; // 1 = he was the best scorer of the 11
  captainBeatAverage: boolean;
  viceBeatAverage: boolean;
  xiAverage: number; // average raw points of the 11
  hits: number; // how many of the 11 scored at least the typical player-match (the all-time median)
}

/** Did the captain choice pay off? Judged only with what Aryan entered: the 11 players he picked each match. */
export async function pickQuality(typical: number): Promise<PickQualityMatch[]> {
  const rows = await loadPickRows();
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.matchId))];
  const ms = ((await db().from("md_matches").select("id, seq, match_number, team1, team2").in("id", ids)).data ?? []) as any[];
  const out: (PickQualityMatch & { seq: number })[] = [];
  for (const m of ms) {
    const xi = rows.filter((r) => r.matchId === m.id);
    const cap = xi.find((r) => r.isCaptain);
    const vc = xi.find((r) => r.isVice);
    if (!xi.length || !cap) continue;
    const mult = (r: (typeof xi)[number]) => (r.isCaptain ? 2 : r.isVice ? 1.5 : 1);
    const avg = xi.reduce((s, r) => s + r.actual, 0) / xi.length;
    out.push({
      seq: m.seq,
      matchId: m.id,
      matchNumber: m.match_number ?? null,
      label: `${m.team1} v ${m.team2}`,
      expected: xi.reduce((s, r) => s + r.predicted * mult(r), 0),
      actual: xi.reduce((s, r) => s + r.actual * mult(r), 0),
      captain: cap.name,
      captainPoints: cap.actual,
      captainRank: 1 + xi.filter((r) => r.actual > cap.actual).length,
      captainBeatAverage: cap.actual > avg,
      viceBeatAverage: !!vc && vc.actual > avg,
      xiAverage: avg,
      hits: xi.filter((r) => r.actual >= typical).length,
    });
  }
  return out.sort((a, b) => a.seq - b.seq);
}
