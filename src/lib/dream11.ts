import type { PlayerMatchStat, Role } from "./types";

/**
 * Dream11 T20 scoring, applied to a player's raw match performance.
 * This follows Dream11's published T20 point table as closely as we know it; the numbers live here in
 * one place so they are easy to correct. Used for (a) the evidence history the predictor learns from and
 * (b) the Actual Points Document Aryan reads from.
 */
export interface PointsBreakdown {
  total: number;
  parts: Record<string, number>;
}

type S = Pick<
  PlayerMatchStat,
  | "runs"
  | "balls"
  | "fours"
  | "sixes"
  | "dismissed"
  | "ballsBowled"
  | "runsConceded"
  | "wickets"
  | "lbwBowled"
  | "maidens"
  | "catches"
  | "stumpings"
  | "roDirect"
  | "roIndirect"
>;

export function dream11Points(s: S, role: Role): PointsBreakdown {
  const parts: Record<string, number> = {};
  const add = (k: string, v: number) => {
    if (v !== 0) parts[k] = (parts[k] ?? 0) + v;
  };

  add("Playing XI", 4);

  // batting
  add("Runs", s.runs);
  add("Boundary bonus", s.fours * 1);
  add("Six bonus", s.sixes * 2);
  if (s.runs >= 100) add("Century bonus", 16);
  else if (s.runs >= 50) add("Half-century bonus", 8);
  else if (s.runs >= 30) add("30-run bonus", 4);
  if (s.dismissed && s.runs === 0 && role !== "BOWL") add("Duck", -2);
  if (role !== "BOWL" && s.balls >= 10) {
    const sr = (s.runs / s.balls) * 100;
    if (sr > 170) add("Strike rate", 6);
    else if (sr > 150) add("Strike rate", 4);
    else if (sr >= 130) add("Strike rate", 2);
    // slow-batting penalties per the published T20 table (Sportskeeda, psainath.org): nothing between 70 and 130
    else if (sr >= 60 && sr <= 70) add("Strike rate", -2);
    else if (sr >= 50 && sr < 60) add("Strike rate", -4);
    else if (sr < 50) add("Strike rate", -6);
  }

  // bowling
  add("Wickets", s.wickets * 25);
  add("LBW/Bowled bonus", s.lbwBowled * 8);
  if (s.wickets >= 5) add("5-wicket bonus", 16);
  else if (s.wickets === 4) add("4-wicket bonus", 8);
  else if (s.wickets === 3) add("3-wicket bonus", 4);
  add("Maidens", s.maidens * 12);
  if (s.ballsBowled >= 12) {
    const eco = (s.runsConceded / s.ballsBowled) * 6;
    if (eco < 5) add("Economy", 6);
    else if (eco < 6) add("Economy", 4);
    else if (eco <= 7) add("Economy", 2);
    else if (eco >= 10 && eco <= 11) add("Economy", -2);
    else if (eco > 11 && eco <= 12) add("Economy", -4);
    else if (eco > 12) add("Economy", -6);
  }

  // fielding
  add("Catches", s.catches * 8);
  if (s.catches >= 3) add("3-catch bonus", 4);
  add("Stumpings", s.stumpings * 12);
  add("Run out (direct)", s.roDirect * 12);
  add("Run out (shared)", s.roIndirect * 6);

  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts };
}
