import { RULES } from "./config";
import type { PlayerPrediction, Role } from "./types";

export interface TeamResult {
  players: PlayerPrediction[]; // the 11
  captain: PlayerPrediction;
  viceCaptain: PlayerPrediction;
  expectedTotal: number; // includes captain / vice-captain multipliers
  totalCredits: number;
}

export interface Check {
  rule: string;
  ok: boolean;
  detail: string;
}

const ROLES: Role[] = ["WK", "BAT", "AR", "BOWL"];

/**
 * Picks the 11 that maximise expected points (the strategy Aryan chose), subject to every Dream11 rule.
 * Exhaustive branch-and-bound over the pool (at most ~26 players), so the result is provably optimal.
 */
export function buildBestTeam(pool: PlayerPrediction[]): TeamResult | null {
  const P = [...pool].sort((a, b) => b.predicted - a.predicted || a.name.localeCompare(b.name));
  const n = P.length;
  const teams = [...new Set(P.map((p) => p.team))];
  const size = RULES.teamSize;

  // suffix availability per role for feasibility pruning
  const availRole = ROLES.map(() => new Array(n + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    ROLES.forEach((r, ri) => (availRole[ri][i] = availRole[ri][i + 1] + (P[i].role === r ? 1 : 0)));
  }
  const prefix = new Array(n + 1).fill(0); // prefix sums of predicted, for the optimistic bound
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + P[i].predicted;

  let best = -Infinity;
  let bestIdx: number[] = [];
  const chosen: number[] = [];
  const roleCount: Record<Role, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
  const teamCount: Record<string, number> = Object.fromEntries(teams.map((t) => [t, 0]));

  const topTwoBonus = (idx: number[]) => {
    let a = -Infinity;
    let b = -Infinity;
    for (const i of idx) {
      const v = P[i].predicted;
      if (v > a) {
        b = a;
        a = v;
      } else if (v > b) b = v;
    }
    return a * (RULES.captainMultiplier - 1) + b * (RULES.viceCaptainMultiplier - 1);
  };

  function dfs(i: number, sum: number, credits: number) {
    const k = chosen.length;
    if (k === size) {
      for (const r of ROLES) if (roleCount[r] < RULES.roleLimits[r].min) return;
      const total = sum + topTwoBonus(chosen);
      if (total > best + 1e-9) {
        best = total;
        bestIdx = [...chosen];
      }
      return;
    }
    if (i >= n || n - i < size - k) return;
    // role feasibility: can still reach every role minimum
    let needed = 0;
    for (let ri = 0; ri < ROLES.length; ri++) {
      const r = ROLES[ri];
      const lack = Math.max(0, RULES.roleLimits[r].min - roleCount[r]);
      if (lack > availRole[ri][i]) return;
      needed += lack;
    }
    if (needed > size - k) return;
    // optimistic bound: best remaining sum + best possible captain extras
    const remaining = prefix[Math.min(n, i + (size - k))] - prefix[i];
    const bound = sum + remaining + P[0].predicted * (RULES.captainMultiplier - 1) + (P[1]?.predicted ?? 0) * (RULES.viceCaptainMultiplier - 1);
    if (bound <= best + 1e-9) return;

    const p = P[i];
    // include
    if (
      credits + p.credit <= RULES.creditBudget + 1e-9 &&
      teamCount[p.team] < RULES.maxPerTeam &&
      roleCount[p.role] < RULES.roleLimits[p.role].max
    ) {
      chosen.push(i);
      roleCount[p.role]++;
      teamCount[p.team]++;
      dfs(i + 1, sum + p.predicted, credits + p.credit);
      teamCount[p.team]--;
      roleCount[p.role]--;
      chosen.pop();
    }
    // exclude
    dfs(i + 1, sum, credits);
  }

  dfs(0, 0, 0);
  if (!bestIdx.length) return null;

  const players = bestIdx.map((i) => P[i]).sort((a, b) => b.predicted - a.predicted || a.name.localeCompare(b.name));
  const captain = players[0];
  const viceCaptain = players[1];
  const totalCredits = players.reduce((a, p) => a + p.credit, 0);
  return { players, captain, viceCaptain, expectedTotal: round1(best), totalCredits: round1(totalCredits) };
}

/** Independent re-check of a finished team against every rule. Nothing is shown to Aryan unless this passes. */
export function validateTeam(team: Pick<TeamResult, "players" | "captain" | "viceCaptain">): Check[] {
  const checks: Check[] = [];
  const ps = team.players;
  checks.push({ rule: "11 players", ok: ps.length === RULES.teamSize && new Set(ps.map((p) => p.playerId)).size === RULES.teamSize, detail: `${ps.length} distinct players` });
  const credits = ps.reduce((a, p) => a + p.credit, 0);
  checks.push({ rule: `Credits within ${RULES.creditBudget}`, ok: credits <= RULES.creditBudget + 1e-9, detail: `${credits.toFixed(1)} used (credit values are estimated)` });
  const byTeam: Record<string, number> = {};
  for (const p of ps) byTeam[p.team] = (byTeam[p.team] ?? 0) + 1;
  checks.push({ rule: `Max ${RULES.maxPerTeam} from one team`, ok: Object.values(byTeam).every((c) => c <= RULES.maxPerTeam), detail: Object.entries(byTeam).map(([t, c]) => `${c} ${t}`).join(" / ") });
  for (const r of ROLES) {
    const c = ps.filter((p) => p.role === r).length;
    const lim = RULES.roleLimits[r];
    checks.push({ rule: `${r} ${lim.min}-${lim.max}`, ok: c >= lim.min && c <= lim.max, detail: `${c} picked` });
  }
  checks.push({ rule: "Captain and vice-captain differ, both in the XI", ok: team.captain.playerId !== team.viceCaptain.playerId && ps.some((p) => p.playerId === team.captain.playerId) && ps.some((p) => p.playerId === team.viceCaptain.playerId), detail: `${team.captain.name} (C), ${team.viceCaptain.name} (VC)` });
  return checks;
}

export interface BenchEntry {
  player: PlayerPrediction;
  reason: string;
}

function legal(players: PlayerPrediction[]): boolean {
  if (players.length !== RULES.teamSize) return false;
  if (players.reduce((a, p) => a + p.credit, 0) > RULES.creditBudget + 1e-9) return false;
  const byTeam: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  for (const p of players) {
    byTeam[p.team] = (byTeam[p.team] ?? 0) + 1;
    byRole[p.role] = (byRole[p.role] ?? 0) + 1;
  }
  if (Object.values(byTeam).some((c) => c > RULES.maxPerTeam)) return false;
  return ROLES.every((r) => (byRole[r] ?? 0) >= RULES.roleLimits[r].min && (byRole[r] ?? 0) <= RULES.roleLimits[r].max);
}

function totalWithCaptains(players: PlayerPrediction[]): number {
  const v = players.map((p) => p.predicted).sort((a, b) => b - a);
  return v.reduce((a, b) => a + b, 0) + v[0] * (RULES.captainMultiplier - 1) + v[1] * (RULES.viceCaptainMultiplier - 1);
}

/**
 * Deterministic, number-backed reasons for leaving each remaining player out: we actually try swapping him in
 * for every player in the XI and report what the best legal swap would do to the expected total.
 */
export function explainBench(pool: PlayerPrediction[], team: TeamResult): BenchEntry[] {
  const picked = new Set(team.players.map((p) => p.playerId));
  const base = totalWithCaptains(team.players);
  const lowest = [...team.players].sort((a, b) => a.predicted - b.predicted)[0];
  return pool
    .filter((p) => !picked.has(p.playerId))
    .sort((a, b) => b.predicted - a.predicted)
    .map((p) => {
      let bestDelta = -Infinity;
      let bestFor: PlayerPrediction | null = null;
      for (const q of team.players) {
        const next = team.players.filter((x) => x.playerId !== q.playerId).concat(p);
        if (!legal(next)) continue;
        const delta = totalWithCaptains(next) - base;
        if (delta > bestDelta) {
          bestDelta = delta;
          bestFor = q;
        }
      }
      let reason: string;
      if (!bestFor) {
        reason = `Expected ${p.predicted} pts at ${p.credit} credits, but no swap with any current pick keeps the team legal (100 credits, max ${RULES.maxPerTeam} per team, role limits).`;
      } else if (p.predicted <= lowest.predicted) {
        reason = `Expected ${p.predicted} pts, below the weakest pick (${lowest.name}, ${lowest.predicted}). Swapping him in for ${bestFor.name} would cost ${Math.abs(bestDelta).toFixed(1)} expected points.`;
      } else {
        reason = `Expected ${p.predicted} pts at ${p.credit} credits. The best legal swap (for ${bestFor.name}, ${bestFor.credit} credits) would cost ${Math.abs(bestDelta).toFixed(1)} expected points once the 100-credit budget, team cap and role limits are respected.`;
      }
      return { player: p, reason };
    });
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
