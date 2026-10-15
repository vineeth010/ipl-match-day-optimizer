import { DEFAULT_WEIGHTS, LEARNING } from "./config";
import type { FactorWeights, Factors, Role, VenueType, WeightsConfig } from "./types";

/** One (prediction, actual) pair: a player Aryan selected and entered the real points for. */
export interface Observation {
  matchId: string;
  matchSeq: number;
  playerId: string;
  name: string;
  role: Role;
  venueType: VenueType;
  factors: Factors;
  basePredicted: number; // weighted blend before role / venue multipliers
  predicted: number; // final prediction shown to Aryan (raw, no captain multiplier)
  actual: number; // raw Dream11 points entered by Aryan (no captain multiplier)
}

export interface LearningResult {
  changed: boolean;
  before: WeightsConfig;
  after: WeightsConfig;
  observations: number;
  matches: number;
  modelMae: number;
  baselineMae: number;
  factorMae: Record<keyof FactorWeights, number>;
  buckets: { kind: "role" | "venue"; key: string; n: number; ratio: number; status: string }[];
  notes: string[]; // plain-language "what I learned", shown on the next match
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function errorSummary(obs: Observation[]) {
  return {
    modelMae: mean(obs.map((o) => Math.abs(o.actual - o.predicted))),
    // naive baseline: "he will score what he averages" (the career factor), no weights involved
    baselineMae: mean(obs.map((o) => Math.abs(o.actual - o.factors.career))),
    // signed gap: positive = the model promised more points than the players delivered
    bias: mean(obs.map((o) => o.predicted - o.actual)),
    baselineBias: mean(obs.map((o) => o.factors.career - o.actual)),
  };
}

/** Per-match accuracy for the trend chart. */
export function accuracyByMatch(obs: Observation[]) {
  const by = new Map<string, Observation[]>();
  for (const o of obs) (by.get(o.matchId) ?? by.set(o.matchId, []).get(o.matchId)!).push(o);
  return [...by.entries()]
    .map(([matchId, list]) => ({ matchId, seq: list[0].matchSeq, n: list.length, ...errorSummary(list) }))
    .sort((a, b) => a.seq - b.seq);
}

export function learnFromObservations(current: WeightsConfig, obs: Observation[]): LearningResult {
  const n = obs.length;
  const matches = new Set(obs.map((o) => o.matchId)).size;
  const { modelMae, baselineMae } = errorSummary(obs);
  const keys = ["form", "career", "venue", "opp", "role"] as (keyof FactorWeights)[];
  const factorMae = Object.fromEntries(keys.map((k) => [k, mean(obs.map((o) => Math.abs(o.actual - o.factors[k])))])) as Record<keyof FactorWeights, number>;

  const notes: string[] = [];
  const buckets: LearningResult["buckets"] = [];

  // Not enough evidence yet: report the error, change nothing.
  if (n < LEARNING.minObsForAnyChange) {
    notes.push(
      `Only ${n} entered result${n === 1 ? "" : "s"} so far (${matches} match${matches === 1 ? "" : "es"}). The system needs at least ${LEARNING.minObsForAnyChange} before it will change any weight, because one match is mostly luck. Weights stay as they are. For now, its predictions were off by ${r1(modelMae)} points per player on average (a simple career-average guess was off by ${r1(baselineMae)}).`,
    );
    return {
      changed: false,
      before: current,
      after: current,
      observations: n,
      matches,
      modelMae: r1(modelMae),
      baselineMae: r1(baselineMae),
      factorMae: Object.fromEntries(keys.map((k) => [k, r1(factorMae[k])])) as LearningResult["factorMae"],
      buckets,
      notes,
    };
  }
  const confidence = n / (n + LEARNING.confidenceHalfLife); // few observations -> small, cautious moves

  // ---- 1. factor weights: lean toward the evidence types with lower error, anchored to the defaults ----
  const mae = keys.map((k) => factorMae[k]);
  const maeBar = mean(mae) || 1;
  const target = keys.map((k, i) => DEFAULT_WEIGHTS.factors[k] * Math.exp(-4 * confidence * ((mae[i] - maeBar) / maeBar)));
  const tsum = target.reduce((a, b) => a + b, 0);
  const newFactors = { ...current.factors };
  keys.forEach((k, i) => {
    const proposed = target[i] / tsum;
    const stepped = clamp(proposed, current.factors[k] - LEARNING.maxFactorStep, current.factors[k] + LEARNING.maxFactorStep);
    newFactors[k] = Math.max(LEARNING.minFactorWeight, stepped);
  });
  const fsum = keys.reduce((a, k) => a + newFactors[k], 0);
  keys.forEach((k) => (newFactors[k] = r2(newFactors[k] / fsum)));
  // fix rounding drift on the largest weight
  const drift = r2(1 - keys.reduce((a, k) => a + newFactors[k], 0));
  const biggest = keys.reduce((a, k) => (newFactors[k] > newFactors[a] ? k : a), keys[0]);
  newFactors[biggest] = r2(newFactors[biggest] + drift);

  for (const k of keys) {
    const d = newFactors[k] - current.factors[k];
    if (Math.abs(d) >= 0.01) {
      notes.push(`${label(k)} weight ${d > 0 ? "raised" : "lowered"} ${pct(current.factors[k])} → ${pct(newFactors[k])}: it was ${d > 0 ? "closer to" : "further from"} the real points than the other evidence (avg error ${r1(factorMae[k])} pts).`);
    }
  }

  // ---- 2. role multipliers: "this kind of player is consistently over/under predicted" ----
  const roleMult = { ...current.roleMult };
  for (const role of ["WK", "BAT", "AR", "BOWL"] as Role[]) {
    const rows = obs.filter((o) => o.role === role);
    if (rows.length === 0) continue;
    if (rows.length < LEARNING.minBucketObs) {
      buckets.push({ kind: "role", key: role, n: rows.length, ratio: 0, status: `only ${rows.length} of ${LEARNING.minBucketObs} observations needed — no change` });
      continue;
    }
    const ratio = sum(rows.map((o) => o.actual)) / Math.max(1, sum(rows.map((o) => o.basePredicted)));
    const shrunk = 1 + (ratio - 1) * (rows.length / (rows.length + 12));
    const next = clamp(clamp(shrunk, LEARNING.multBounds[0], LEARNING.multBounds[1]), current.roleMult[role] - LEARNING.maxMultStep, current.roleMult[role] + LEARNING.maxMultStep);
    roleMult[role] = r2(next);
    buckets.push({ kind: "role", key: role, n: rows.length, ratio: r2(ratio), status: "evaluated" });
    if (Math.abs(roleMult[role] - current.roleMult[role]) >= 0.01) {
      notes.push(`${role === "BOWL" ? "Bowlers" : role === "BAT" ? "Batters" : role === "AR" ? "All-rounders" : "Wicketkeepers"} were ${ratio < 1 ? "over" : "under"}-predicted by ${Math.abs(Math.round((1 - ratio) * 100))}% across ${rows.length} entries → ${role} multiplier ${current.roleMult[role].toFixed(2)} → ${roleMult[role].toFixed(2)}.`);
    }
  }

  // ---- 3. venue-type multipliers: "this type of match goes wrong" (high / mid / low scoring grounds) ----
  const venueMult = { ...current.venueMult };
  for (const vt of ["high", "mid", "low"] as VenueType[]) {
    const rows = obs.filter((o) => o.venueType === vt);
    if (rows.length === 0) continue;
    if (rows.length < LEARNING.minBucketObs) {
      buckets.push({ kind: "venue", key: vt, n: rows.length, ratio: 0, status: `only ${rows.length} of ${LEARNING.minBucketObs} observations needed — no change` });
      continue;
    }
    const ratio = sum(rows.map((o) => o.actual)) / Math.max(1, sum(rows.map((o) => o.basePredicted * roleMult[o.role])));
    const shrunk = 1 + (ratio - 1) * (rows.length / (rows.length + 12));
    const next = clamp(clamp(shrunk, LEARNING.multBounds[0], LEARNING.multBounds[1]), current.venueMult[vt] - LEARNING.maxMultStep, current.venueMult[vt] + LEARNING.maxMultStep);
    venueMult[vt] = r2(next);
    buckets.push({ kind: "venue", key: vt, n: rows.length, ratio: r2(ratio), status: "evaluated" });
    if (Math.abs(venueMult[vt] - current.venueMult[vt]) >= 0.01) {
      notes.push(`At ${vt}-scoring grounds players were ${ratio < 1 ? "over" : "under"}-predicted by ${Math.abs(Math.round((1 - ratio) * 100))}% across ${rows.length} entries → multiplier ${current.venueMult[vt].toFixed(2)} → ${venueMult[vt].toFixed(2)}.`);
    }
  }

  if (notes.length === 0) {
    notes.push(
      n < LEARNING.minBucketObs
        ? `Only ${n} entries so far — too few to justify any change. Weights stay as they are.`
        : "No consistent pattern big enough to justify a change yet. Weights stay as they are.",
    );
  }

  const changed =
    keys.some((k) => Math.abs(newFactors[k] - current.factors[k]) >= 0.005) ||
    (Object.keys(roleMult) as Role[]).some((k) => Math.abs(roleMult[k] - current.roleMult[k]) >= 0.005) ||
    (Object.keys(venueMult) as VenueType[]).some((k) => Math.abs(venueMult[k] - current.venueMult[k]) >= 0.005);

  const after: WeightsConfig = {
    version: current.version + (changed ? 1 : 0),
    factors: changed ? newFactors : current.factors,
    roleMult: changed ? roleMult : current.roleMult,
    venueMult: changed ? venueMult : current.venueMult,
    note: changed ? `Learned from ${n} entries across ${matches} match(es)` : current.note,
  };

  return { changed, before: current, after, observations: n, matches, modelMae: r1(modelMae), baselineMae: r1(baselineMae), factorMae: Object.fromEntries(keys.map((k) => [k, r1(factorMae[k])])) as LearningResult["factorMae"], buckets, notes };
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const pct = (v: number) => `${Math.round(v * 100)}%`;
function label(k: keyof FactorWeights) {
  return { form: "Recent form", career: "Career average", venue: "Record at this ground", opp: "Record vs this opponent", role: "Role baseline" }[k];
}
