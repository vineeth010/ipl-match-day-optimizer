/**
 * The "points scale": what Dream11 points actually look like in the IPL, so a number like "68" has context.
 * Computed once from the stored history (scripts/points-scale.ts) and read from md_meta by the app.
 */
export interface Performance {
  player: string;
  playerId: string;
  role: string;
  team: string;
  opponent: string;
  date: string;
  points: number;
  summary: string; // e.g. "175 off 66 balls, 2 wkts"
}

export interface PointsScale {
  rows: number;
  firstSeason: string;
  lastSeason: string;
  min: number;
  median: number;
  p90: number;
  p99: number;
  max: Performance;
  /** record performance in each kind of contribution, chosen by what the player did (not by a fragile role label) */
  records: { batter: Performance; bowler: Performance; allRounder: Performance; keeper: Performance };
  top5: Performance[];
  share: { above100: number; above150: number; above200: number };
}

/** Measured over the 74-match replay of IPL 2026 (scripts/entry-xlsx.ts); shown as context, not as a guarantee. */
export interface PredictionRange {
  poolMin: number;
  poolMax: number;
  teamMin: number;
  teamMax: number;
  teamMean: number;
}

export const FALLBACK_SCALE: PointsScale = {
  rows: 27909,
  firstSeason: "2008",
  lastSeason: "2026",
  min: -4,
  median: 30,
  p90: 86,
  p99: 143,
  max: { player: "CH Gayle", playerId: "", role: "BAT", team: "Royal Challengers Bangalore", opponent: "Pune Warriors", date: "2013-04-23", points: 306, summary: "175 off 66 balls, 2 wkts" },
  records: {
    batter: { player: "CH Gayle", playerId: "", role: "BAT", team: "Royal Challengers Bangalore", opponent: "Pune Warriors", date: "2013-04-23", points: 306, summary: "175 off 66 balls, 2 wkts" },
    bowler: { player: "", playerId: "", role: "BOWL", team: "", opponent: "", date: "", points: 0, summary: "" },
    allRounder: { player: "", playerId: "", role: "AR", team: "", opponent: "", date: "", points: 0, summary: "" },
    keeper: { player: "", playerId: "", role: "WK", team: "", opponent: "", date: "", points: 0, summary: "" },
  },
  top5: [],
  share: { above100: 0.057, above150: 0.0073, above200: 0.0008 },
};

export const FALLBACK_RANGE: PredictionRange = { poolMin: 14, poolMax: 76, teamMin: 441, teamMax: 623, teamMean: 518 };

export function summarise(s: { runs: number; balls: number; wickets: number; catches: number; stumpings: number }): string {
  const parts: string[] = [];
  if (s.balls > 0 && s.runs >= 10) parts.push(`${s.runs} off ${s.balls} balls`);
  if (s.wickets > 0) parts.push(`${s.wickets} wkt${s.wickets > 1 ? "s" : ""}`);
  if (s.catches >= 2) parts.push(`${s.catches} catches`);
  if (s.stumpings >= 1) parts.push(`${s.stumpings} stumping${s.stumpings > 1 ? "s" : ""}`);
  return parts.join(", ") || "all-round contribution";
}
