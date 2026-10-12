import { DEFAULT_WEIGHTS } from "./config";
import {
  db,
  getActuals,
  getLatestWeights,
  getMatch,
  getPredictions,
  getRecommendation,
  learningBefore,
  listLearningLog,
  loadEvidence,
  loadObservations,
  playerNames,
  saveWeights,
} from "./db";
import { predictPool } from "./engine";
import { explainTeam } from "./gemini";
import { accuracyByMatch, learnFromObservations } from "./learning";
import { buildBestTeam, explainBench, validateTeam } from "./optimizer";
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

/** Evidence -> prediction -> legal team -> Gemini reasoning -> saved predictions. */
export async function generateForMatch(matchId: string) {
  const match = await getMatch(matchId);
  if (!match) throw new HttpError(404, "Match not found");
  if (!match.isIpl2026) throw new HttpError(400, "Only IPL 2026 matches can be generated");
  if ((await getActuals(matchId)).length) throw new HttpError(409, "Actual points are already entered for this match, so its recommendation is locked.");

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
  const del = await db().from("md_predictions").delete().eq("match_id", matchId);
  if (del.error) throw new Error(del.error.message);
  const ins = await db().from("md_predictions").insert(predRows);
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
  return { match, rec, xi, byId, previousLearning, currentWeights: weights, hasActuals: actuals.length > 0 };
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
  const up = await db().from("md_actuals").upsert(rows, { onConflict: "match_id,player_id" });
  if (up.error) throw new Error(`save actuals: ${up.error.message}`);

  const observations = await loadObservations();
  const current = await getLatestWeights();
  const result = learnFromObservations(current, observations);
  if (result.changed) await saveWeights(result.after);
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
