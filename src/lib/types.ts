export type Role = "WK" | "BAT" | "AR" | "BOWL";
export type VenueType = "high" | "mid" | "low";

/** One player's raw performance in one match (parsed from Cricsheet ball-by-ball). */
export interface PlayerMatchStat {
  matchId: string;
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  venue: string; // normalised venue key
  date: string; // YYYY-MM-DD
  seq: number; // chronological order across the whole dataset (the date gate key)
  batPos: number | null;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissed: boolean;
  ballsBowled: number;
  runsConceded: number;
  wickets: number; // wickets credited to the bowler (excludes run outs)
  lbwBowled: number;
  maidens: number;
  catches: number;
  stumpings: number;
  roDirect: number;
  roIndirect: number;
  d11?: number; // Dream11 points, filled after roles are known
}

export interface MatchRow {
  id: string;
  seq: number;
  season: string;
  matchNumber: number | null;
  date: string;
  venue: string; // normalised venue key
  venueFull: string;
  city: string | null;
  team1: string;
  team2: string;
  tossWinner: string | null;
  tossDecision: string | null;
  winner: string | null;
  resultText: string | null;
  playerOfMatch: string | null;
  inn1Runs: number | null;
  inn2Runs: number | null;
  isIpl2026: boolean;
}

export interface PlayerRow {
  id: string;
  name: string;
  role: Role;
  roleSource: "history" | "ai" | "default";
}

export interface FactorWeights {
  form: number;
  career: number;
  venue: number;
  opp: number;
  role: number;
}

export interface WeightsConfig {
  version: number;
  factors: FactorWeights;
  roleMult: Record<Role, number>;
  venueMult: Record<VenueType, number>;
  note?: string;
}

export interface Factors {
  form: number;
  career: number;
  venue: number;
  opp: number;
  role: number;
}

export interface PlayerPrediction {
  playerId: string;
  name: string;
  team: string;
  role: Role;
  roleSource: string;
  credit: number;
  creditSource: "estimated";
  predicted: number; // raw expected Dream11 points (no captain multiplier)
  factors: Factors;
  matchesOfHistory: number;
  venueMatches: number;
  oppMatches: number;
  last5: number[]; // most recent first
}
