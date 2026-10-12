import fs from "node:fs";
import path from "node:path";
import { parseCricsheetMatch } from "./cricsheet";
import { dream11Points } from "./dream11";
import { buildRoles } from "./roles";
import type { MatchRow, PlayerMatchStat, PlayerRow, Role } from "./types";

export interface Dataset {
  matches: MatchRow[]; // sorted by seq
  stats: PlayerMatchStat[]; // with d11 filled
  players: Map<string, PlayerRow>;
  pools: Map<string, { playerId: string; team: string }[]>;
  rolePriors: Record<Role, number>;
}

/** Build the whole dataset from a folder of Cricsheet JSON files (used by ingestion and offline tests). */
export function buildDatasetFromDir(dir: string): Dataset {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const parsed = files.map((f) => {
    const id = path.basename(f, ".json");
    return parseCricsheetMatch(id, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  });

  // chronological order; two matches on one day are ordered by their Cricsheet id (which follows fixture order)
  parsed.sort((a, b) => a.match.date.localeCompare(b.match.date) || Number(a.match.id) - Number(b.match.id));
  const seqOf = new Map<string, number>();
  parsed.forEach((p, i) => seqOf.set(p.match.id, i + 1));

  const matches: MatchRow[] = parsed.map((p) => ({ ...p.match, seq: seqOf.get(p.match.id)! }));
  const stats: PlayerMatchStat[] = [];
  const names = new Map<string, string>();
  const pools = new Map<string, { playerId: string; team: string }[]>();
  for (const p of parsed) {
    pools.set(p.match.id, p.pool);
    for (const [id, nm] of Object.entries(p.playerNames)) names.set(id, nm);
    for (const s of p.stats) stats.push({ ...s, seq: seqOf.get(p.match.id)! });
  }

  const players = buildRoles(stats, names);
  const sums: Record<Role, { t: number; n: number }> = {
    WK: { t: 0, n: 0 },
    BAT: { t: 0, n: 0 },
    AR: { t: 0, n: 0 },
    BOWL: { t: 0, n: 0 },
  };
  for (const s of stats) {
    const role = players.get(s.playerId)?.role ?? "BAT";
    s.d11 = dream11Points(s, role).total;
    if (s.date < "2026-03-01") {
      sums[role].t += s.d11;
      sums[role].n += 1;
    }
  }
  const rolePriors = Object.fromEntries(
    (Object.keys(sums) as Role[]).map((r) => [r, sums[r].n ? sums[r].t / sums[r].n : 25]),
  ) as Record<Role, number>;

  return { matches, stats, players, pools, rolePriors };
}
