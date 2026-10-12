import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_WEIGHTS } from "./config";
import { FALLBACK_RANGE, FALLBACK_SCALE, type PointsScale, type PredictionRange } from "./scale";
import type { EvidenceInput } from "./engine";
import type { Observation } from "./learning";
import type { MatchRow, PlayerMatchStat, PlayerRow, Role, WeightsConfig } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

let client: SupabaseClient | null = null;
/** Server-side only: uses the service-role key, which must never reach the browser. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function must<T>(res: { data: T | null; error: any }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

/** PostgREST returns at most 1000 rows per request, so page through. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await build(from, from + 999), what);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function upsertBatched(table: string, rows: object[], onConflict: string, size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db().from(table).upsert(rows.slice(i, i + size), { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

// ---------- mappers ----------
export const toMatch = (r: any): MatchRow => ({
  id: r.id,
  seq: r.seq,
  season: r.season,
  matchNumber: r.match_number,
  date: r.match_date,
  venue: r.venue,
  venueFull: r.venue_full ?? r.venue,
  city: r.city,
  team1: r.team1,
  team2: r.team2,
  tossWinner: r.toss_winner,
  tossDecision: r.toss_decision,
  winner: r.winner,
  resultText: r.result_text,
  playerOfMatch: r.player_of_match,
  inn1Runs: r.inn1_runs,
  inn2Runs: r.inn2_runs,
  isIpl2026: r.is_ipl2026,
});

const toStat = (r: any): PlayerMatchStat => ({
  matchId: r.match_id,
  playerId: r.player_id,
  playerName: "",
  team: r.team,
  opponent: r.opponent,
  venue: r.venue,
  date: r.match_date,
  seq: r.seq,
  batPos: r.bat_pos,
  runs: r.runs,
  balls: r.balls,
  fours: r.fours,
  sixes: r.sixes,
  dismissed: r.dismissed,
  ballsBowled: r.balls_bowled,
  runsConceded: r.runs_conceded,
  wickets: r.wickets,
  lbwBowled: r.lbw_bowled,
  maidens: r.maidens,
  catches: r.catches,
  stumpings: r.stumpings,
  roDirect: r.ro_direct,
  roIndirect: r.ro_indirect,
  d11: Number(r.d11),
});

// ---------- reads ----------
export async function listIplMatches(): Promise<MatchRow[]> {
  const rows = await fetchAll<any>((f, t) => db().from("md_matches").select("*").eq("is_ipl2026", true).order("seq").range(f, t), "list matches");
  return rows.map(toMatch);
}

export async function getMatch(id: string): Promise<MatchRow | null> {
  const { data, error } = await db().from("md_matches").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`get match: ${error.message}`);
  return data ? toMatch(data) : null;
}

export async function getLatestWeights(): Promise<WeightsConfig> {
  const { data, error } = await db().from("md_weights").select("*").order("version", { ascending: false }).limit(1);
  if (error) throw new Error(`weights: ${error.message}`);
  if (!data?.length) {
    const first: WeightsConfig = { ...DEFAULT_WEIGHTS, version: 1 };
    await saveWeights(first);
    return first;
  }
  return fromWeightsRow(data[0]);
}

const fromWeightsRow = (r: any): WeightsConfig => ({ version: r.version, factors: r.factors, roleMult: r.role_mult, venueMult: r.venue_mult, note: r.note ?? undefined });

export async function listWeights(): Promise<(WeightsConfig & { createdAt: string })[]> {
  const { data, error } = await db().from("md_weights").select("*").order("version");
  if (error) throw new Error(`weights: ${error.message}`);
  return (data ?? []).map((r) => ({ ...fromWeightsRow(r), createdAt: r.created_at }));
}

export async function saveWeights(w: WeightsConfig) {
  const { error } = await db().from("md_weights").upsert({ version: w.version, factors: w.factors, role_mult: w.roleMult, venue_mult: w.venueMult, note: w.note ?? null }, { onConflict: "version" });
  if (error) throw new Error(`save weights: ${error.message}`);
}

/** The date gate lives here: only rows with seq strictly below the target match are ever fetched. */
export async function loadEvidence(match: MatchRow, weights: WeightsConfig): Promise<Omit<EvidenceInput, "weights">> {
  const poolRows = must(await db().from("md_match_players").select("player_id, team").eq("match_id", match.id), "pool");
  const pool = poolRows.map((r: any) => ({ playerId: r.player_id, team: r.team }));
  const ids = pool.map((p) => p.playerId);
  void weights;

  const playerRows = must(await db().from("md_players").select("*").in("id", ids), "players");
  const players = new Map<string, PlayerRow>(playerRows.map((r: any) => [r.id, { id: r.id, name: r.name, role: r.role as Role, roleSource: r.role_source }]));

  const histRows = await fetchAll<any>((f, t) => db().from("md_player_stats").select("*").in("player_id", ids).lt("seq", match.seq).order("seq", { ascending: false }).range(f, t), "history");
  const history = histRows.map(toStat);

  const venueRows = await fetchAll<any>((f, t) => db().from("md_matches").select("*").eq("venue", match.venue).lt("seq", match.seq).order("seq").range(f, t), "venue matches");
  const venueMatches = venueRows.map(toMatch);

  const metaRow = must(await db().from("md_meta").select("value").eq("key", "role_priors").maybeSingle(), "role priors");
  const rolePriors = (metaRow as any)?.value ?? { WK: 40, BAT: 36, AR: 43, BOWL: 36 };

  return { target: match, pool, players, history, venueMatches, rolePriors };
}

export async function getRecommendation(matchId: string) {
  const { data, error } = await db().from("md_recommendations").select("*").eq("match_id", matchId).maybeSingle();
  if (error) throw new Error(`recommendation: ${error.message}`);
  return data;
}

export async function getPredictions(matchId: string) {
  return must(await db().from("md_predictions").select("*").eq("match_id", matchId), "predictions") as any[];
}

export async function getActuals(matchId: string) {
  return must(await db().from("md_actuals").select("*").eq("match_id", matchId), "actuals") as any[];
}

export async function matchStatusMap(): Promise<Map<string, { generated: boolean; entered: boolean }>> {
  const recs = await fetchAll<any>((f, t) => db().from("md_recommendations").select("match_id").range(f, t), "recs");
  const acts = await fetchAll<any>((f, t) => db().from("md_actuals").select("match_id").range(f, t), "actuals");
  const m = new Map<string, { generated: boolean; entered: boolean }>();
  for (const r of recs) m.set(r.match_id, { generated: true, entered: false });
  for (const a of acts) m.set(a.match_id, { generated: true, entered: true });
  return m;
}

export async function playerNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = must(await db().from("md_players").select("id, name").in("id", ids), "names") as any[];
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Every (prediction, actual) pair Aryan has produced so far, for the learning loop and accuracy trend. */
export async function loadObservations(): Promise<Observation[]> {
  const actuals = await fetchAll<any>((f, t) => db().from("md_actuals").select("*").range(f, t), "all actuals");
  if (!actuals.length) return [];
  const matchIds = [...new Set(actuals.map((a) => a.match_id))];
  const preds = await fetchAll<any>((f, t) => db().from("md_predictions").select("*").in("match_id", matchIds).eq("selected", true).range(f, t), "selected predictions");
  const matches = must(await db().from("md_matches").select("id, seq").in("id", matchIds), "match seqs") as any[];
  const seqOf = new Map(matches.map((m) => [m.id, m.seq]));
  const names = await playerNames([...new Set(preds.map((p) => p.player_id))]);
  const actualKey = new Map(actuals.map((a) => [a.match_id + "|" + a.player_id, Number(a.actual_points)]));
  const out: Observation[] = [];
  for (const p of preds) {
    const actual = actualKey.get(p.match_id + "|" + p.player_id);
    if (actual === undefined) continue;
    out.push({
      matchId: p.match_id,
      matchSeq: seqOf.get(p.match_id) ?? 0,
      playerId: p.player_id,
      name: names.get(p.player_id) ?? p.player_id,
      role: p.role,
      venueType: p.venue_type,
      factors: p.factors,
      basePredicted: Number(p.base_predicted),
      predicted: Number(p.predicted),
      actual,
    });
  }
  return out;
}

export async function listLearningLog(limit = 50) {
  return must(await db().from("md_learning_log").select("*").order("id", { ascending: false }).limit(limit), "learning log") as any[];
}

/** The most recent learning entry from a match that finished BEFORE this one (what the agent carries forward). */
export async function learningBefore(seq: number) {
  const log = await listLearningLog(200);
  if (!log.length) return null;
  const ids = [...new Set(log.map((l) => l.after_match_id))];
  const ms = must(await db().from("md_matches").select("id, seq, team1, team2, match_number").in("id", ids), "log matches") as any[];
  const info = new Map(ms.map((m) => [m.id, m]));
  const eligible = log.filter((l) => (info.get(l.after_match_id)?.seq ?? Infinity) < seq);
  if (!eligible.length) return null;
  const latest = eligible[0];
  return { ...latest, from: info.get(latest.after_match_id) };
}

export async function getPointsScale(): Promise<PointsScale> {
  const { data } = await db().from("md_meta").select("value").eq("key", "points_scale").maybeSingle();
  return ((data as any)?.value as PointsScale) ?? FALLBACK_SCALE;
}

export async function getPredictionRange(): Promise<PredictionRange> {
  const { data } = await db().from("md_meta").select("value").eq("key", "prediction_range").maybeSingle();
  return ((data as any)?.value as PredictionRange) ?? FALLBACK_RANGE;
}
