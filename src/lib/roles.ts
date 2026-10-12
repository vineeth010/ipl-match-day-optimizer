import { ROLE_CUTOFF_DATE } from "./config";
import type { PlayerMatchStat, PlayerRow, Role } from "./types";

/**
 * Cricsheet has no role field, so we infer one from IPL history, using only matches before
 * ROLE_CUTOFF_DATE so the replayed season can never leak into a role label.
 *   WK   : at least 2 career stumpings
 *   BOWL : bowls regularly and does little batting
 *   AR   : bowls and bats a meaningful amount
 *   BAT  : everyone else
 */
export function inferRole(rows: PlayerMatchStat[]): Role | null {
  if (rows.length === 0) return null;
  const n = rows.length;
  const stumpings = rows.reduce((a, r) => a + r.stumpings, 0);
  if (stumpings >= 2) return "WK";
  const ballsBowled = rows.reduce((a, r) => a + r.ballsBowled, 0);
  const ballsFaced = rows.reduce((a, r) => a + r.balls, 0);
  const batted = rows.filter((r) => r.batPos != null);
  const pos = batted.length ? batted.reduce((a, r) => a + (r.batPos ?? 0), 0) / batted.length : 11;
  const ovPM = ballsBowled / 6 / n;
  const fbPM = ballsFaced / n;
  if (ovPM >= 1.0) return pos <= 7.6 && fbPM >= 5 ? "AR" : "BOWL";
  if (ovPM >= 0.5 && fbPM >= 12) return "AR";
  if (ovPM >= 0.6 && fbPM < 6) return "BOWL";
  return "BAT";
}

/**
 * Known wicketkeepers (Cricsheet name format). Keepers who rarely stump are invisible to the stumping rule,
 * and Dream11 needs at least one WK in every team. This is public squad knowledge, not match results.
 */
export const KNOWN_KEEPERS = new Set([
  "MS Dhoni", "RR Pant", "SV Samson", "KL Rahul", "Ishan Kishan", "H Klaasen", "JC Buttler", "Q de Kock",
  "PD Salt", "JM Sharma", "Dhruv Jurel", "N Pooran", "RD Rickelton", "A Porel", "P Simran Singh", "JP Inglis",
  "TL Seifert", "FH Allen", "KS Bharat", "Anuj Rawat", "Vishnu Vinod", "WP Saha", "Tom Kohler-Cadmore", "Abishek Porel",
]);

export function buildRoles(
  allStats: PlayerMatchStat[],
  names: Map<string, string>,
  cutoff = ROLE_CUTOFF_DATE,
): Map<string, PlayerRow> {
  const byPlayer = new Map<string, PlayerMatchStat[]>();
  for (const s of allStats) if (s.date < cutoff) (byPlayer.get(s.playerId) ?? byPlayer.set(s.playerId, []).get(s.playerId)!).push(s);
  const out = new Map<string, PlayerRow>();
  for (const [id, name] of names) {
    const role = KNOWN_KEEPERS.has(name) ? "WK" : inferRole(byPlayer.get(id) ?? []);
    out.set(id, { id, name, role: role ?? "BAT", roleSource: role ? "history" : "default" });
  }
  return out;
}

/** Safety net: a legal Dream11 team needs a keeper. If a pool has none, promote its most keeper-like batter. */
export function keeperScore(rows: PlayerMatchStat[]): number {
  if (!rows.length) return 0;
  return (rows.reduce((a, r) => a * 1 + r.stumpings * 5 + r.catches, 0)) / rows.length;
}
