import type { WeightsConfig } from "./types";

/** Dream11 team rules (T20). Credit total and roles are verified against the app by the user. */
export const RULES = {
  teamSize: 11,
  creditBudget: 100,
  maxPerTeam: 7,
  roleLimits: {
    WK: { min: 1, max: 4 },
    BAT: { min: 3, max: 6 },
    AR: { min: 1, max: 4 },
    BOWL: { min: 3, max: 6 },
  },
  captainMultiplier: 2,
  viceCaptainMultiplier: 1.5,
} as const;

export const DEFAULT_WEIGHTS: WeightsConfig = {
  version: 0,
  factors: { form: 0.35, career: 0.25, venue: 0.2, opp: 0.1, role: 0.1 },
  roleMult: { WK: 1, BAT: 1, AR: 1, BOWL: 1 },
  venueMult: { high: 1, mid: 1, low: 1 },
  note: "Default starting weights",
};

/** Learning-loop guardrails. */
export const LEARNING = {
  minObsForAnyChange: 22, // two matches of entries; below this nothing moves (one match is mostly noise)
  minBucketObs: 6, // minimum observations before a role / venue-type bucket may move
  maxFactorStep: 0.05, // max change of one factor weight per update
  minFactorWeight: 0.05,
  maxMultStep: 0.05, // max change of one multiplier per update
  multBounds: [0.8, 1.2] as const,
  confidenceHalfLife: 44, // observations at which learning confidence reaches 50%
};

/** Shrinkage strengths for the evidence factors. */
export const SHRINK = { career: 5, venue: 3, opp: 3 };

/**
 * A player with no (or little) history is not "an average player": the role average is dominated by established
 * stars. Without this discount the optimizer would prefer unknown players over proven mid-level ones.
 */
export const UNKNOWN_PLAYER_DISCOUNT = 0.8;

/** Roles are derived only from IPL history before this date, so they never peek at the replayed season. */
export const ROLE_CUTOFF_DATE = "2026-03-01";

/** The replayed season. */
export const REPLAY_SEASON = "2026";

export const FORM_WEIGHTS = [0.35, 0.25, 0.2, 0.12, 0.08];
