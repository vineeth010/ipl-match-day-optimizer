import { FORM_WEIGHTS, SHRINK, UNKNOWN_PLAYER_DISCOUNT } from "./config";
import { keeperScore } from "./roles";
import type {
  Factors,
  MatchRow,
  PlayerMatchStat,
  PlayerPrediction,
  PlayerRow,
  Role,
  VenueType,
  WeightsConfig,
} from "./types";

/**
 * Everything the predictor is allowed to see for one match.
 * `history` and `venueMatches` MUST only contain rows older than the target match; assertDateGate() checks it.
 */
export interface EvidenceInput {
  target: MatchRow;
  pool: { playerId: string; team: string }[];
  players: Map<string, PlayerRow>;
  history: PlayerMatchStat[];
  venueMatches: MatchRow[];
  rolePriors: Record<Role, number>;
  weights: WeightsConfig;
}

export class DateGateError extends Error {}

/** The guardrail behind the "no peeking at the future" rule. Throws if any evidence is not strictly older. */
export function assertDateGate(input: Pick<EvidenceInput, "target" | "history" | "venueMatches">) {
  const { target } = input;
  for (const h of input.history) {
    if (h.seq >= target.seq) throw new DateGateError(`history row ${h.matchId} (seq ${h.seq}) is not before match ${target.id} (seq ${target.seq})`);
  }
  for (const m of input.venueMatches) {
    if (m.seq >= target.seq) throw new DateGateError(`venue match ${m.id} (seq ${m.seq}) is not before match ${target.id} (seq ${target.seq})`);
  }
}

export interface VenueProfile {
  type: VenueType;
  matches: number;
  avgFirstInnings: number | null;
  chaseWinPct: number | null;
}

export function venueProfile(venueMatches: MatchRow[]): VenueProfile {
  const withInn = venueMatches.filter((m) => m.inn1Runs != null);
  const n = withInn.length;
  if (n < 3) return { type: "mid", matches: n, avgFirstInnings: n ? avg(withInn.map((m) => m.inn1Runs!)) : null, chaseWinPct: null };
  const a = avg(withInn.map((m) => m.inn1Runs!));
  const decided = venueMatches.filter((m) => m.winner);
  const chaseWins = decided.filter((m) => {
    const chaser = m.tossWinner && m.tossDecision === "field" ? m.tossWinner : m.tossWinner ? (m.team1 === m.tossWinner ? m.team2 : m.team1) : null;
    return chaser && m.winner === chaser;
  }).length;
  return {
    type: a >= 178 ? "high" : a <= 166 ? "low" : "mid",
    matches: n,
    avgFirstInnings: Math.round(a),
    chaseWinPct: decided.length ? Math.round((chaseWins / decided.length) * 100) : null,
  };
}

function avg(a: number[]) {
  return a.reduce((x, y) => x + y, 0) / a.length;
}

function shrunkMean(values: number[], prior: number, k: number) {
  return (values.reduce((a, b) => a + b, 0) + k * prior) / (values.length + k);
}

export function creditFromStrength(strength: number): number {
  const t = Math.max(0, Math.min(1, (strength - 22) / 30));
  return Math.round((6.5 + t * 4.5) * 2) / 2;
}

export function predictPool(input: EvidenceInput): { predictions: PlayerPrediction[]; venue: VenueProfile } {
  assertDateGate(input);
  const { target, weights, rolePriors } = input;
  const venue = venueProfile(input.venueMatches);

  const histBy = new Map<string, PlayerMatchStat[]>();
  for (const h of input.history) (histBy.get(h.playerId) ?? histBy.set(h.playerId, []).get(h.playerId)!).push(h);

  // safety net: Dream11 needs a wicketkeeper, so if the pool has none, promote the most keeper-like batter
  const roleOverride = new Map<string, Role>();
  if (!input.pool.some(({ playerId }) => input.players.get(playerId)?.role === "WK")) {
    let bestId: string | null = null;
    let bestScore = -1;
    for (const { playerId } of input.pool) {
      if ((input.players.get(playerId)?.role ?? "BAT") !== "BAT") continue;
      const s = keeperScore(histBy.get(playerId) ?? []);
      if (s > bestScore) {
        bestScore = s;
        bestId = playerId;
      }
    }
    if (bestId) roleOverride.set(bestId, "WK");
  }

  const predictions: PlayerPrediction[] = input.pool.map(({ playerId, team }) => {
    const pl = input.players.get(playerId);
    const role: Role = roleOverride.get(playerId) ?? pl?.role ?? "BAT";
    const rows = (histBy.get(playerId) ?? []).sort((a, b) => b.seq - a.seq); // most recent first
    const pts = rows.map((r) => r.d11 ?? 0);
    const opponent = team === target.team1 ? target.team2 : target.team1;

    const rolePrior = rolePriors[role];
    const career = shrunkMean(pts, rolePrior * UNKNOWN_PLAYER_DISCOUNT, SHRINK.career);

    const last5 = pts.slice(0, 5);
    let form = career;
    if (last5.length) {
      const w = FORM_WEIGHTS.slice(0, last5.length);
      const ws = w.reduce((a, b) => a + b, 0);
      const raw = last5.reduce((a, v, i) => a + v * w[i], 0) / ws;
      form = (raw * last5.length + career * 2) / (last5.length + 2); // light shrink toward career for tiny samples
    }

    const venuePts = rows.filter((r) => r.venue === target.venue).map((r) => r.d11 ?? 0);
    const oppPts = rows.filter((r) => r.opponent === opponent).map((r) => r.d11 ?? 0);
    const venueF = shrunkMean(venuePts, career, SHRINK.venue);
    const oppF = shrunkMean(oppPts, career, SHRINK.opp);

    const roleFactor = rows.length >= 3 ? rolePrior : rolePrior * UNKNOWN_PLAYER_DISCOUNT;
    const factors: Factors = { form, career, venue: venueF, opp: oppF, role: roleFactor };
    const f = weights.factors;
    const base = f.form * form + f.career * career + f.venue * venueF + f.opp * oppF + f.role * roleFactor;
    const predicted = base * weights.roleMult[role] * weights.venueMult[venue.type];

    const strength = 0.5 * career + 0.5 * form;
    return {
      playerId,
      name: pl?.name ?? playerId,
      team,
      role,
      roleSource: roleOverride.has(playerId) ? "inferred" : (pl?.roleSource ?? "default"),
      credit: creditFromStrength(strength),
      creditSource: "estimated" as const,
      predicted: round1(predicted),
      factors: Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, round1(v)])) as unknown as Factors,
      matchesOfHistory: rows.length,
      venueMatches: venuePts.length,
      oppMatches: oppPts.length,
      last5: last5.map(round1),
    };
  });
  return { predictions, venue };
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}
