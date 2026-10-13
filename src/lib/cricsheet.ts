import type { MatchRow, PlayerMatchStat } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Grounds that were renamed or are spelled differently across seasons. */
const VENUE_ALIASES: Record<string, string> = {
  "Feroz Shah Kotla": "Arun Jaitley Stadium",
  "M.Chinnaswamy Stadium": "M Chinnaswamy Stadium",
  "Punjab Cricket Association Stadium": "Punjab Cricket Association IS Bindra Stadium",
  "Sardar Patel Stadium": "Narendra Modi Stadium",
  "Zayed Cricket Stadium": "Sheikh Zayed Stadium",
  "Subrata Roy Sahara Stadium": "Maharashtra Cricket Association Stadium",
};

/** Venue keys: drop the city suffix so "Wankhede Stadium, Mumbai" and "Wankhede Stadium" match. */
export function venueKey(venue: string): string {
  const base = venue.split(",")[0].trim();
  return VENUE_ALIASES[base] ?? base;
}

export interface ParsedMatch {
  match: Omit<MatchRow, "seq">;
  stats: Omit<PlayerMatchStat, "seq" | "d11">[];
  playerNames: Record<string, string>; // id -> name
  pool: { playerId: string; team: string; substitute: boolean }[]; // everyone listed; substitute = Impact Player / concussion sub who came on
}

function blank(
  matchId: string,
  playerId: string,
  name: string,
  team: string,
  opponent: string,
  venue: string,
  date: string,
): Omit<PlayerMatchStat, "seq" | "d11"> {
  return {
    matchId,
    playerId,
    playerName: name,
    team,
    opponent,
    venue,
    date,
    batPos: null,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dismissed: false,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    lbwBowled: 0,
    maidens: 0,
    catches: 0,
    stumpings: 0,
    roDirect: 0,
    roIndirect: 0,
  };
}

export function parseCricsheetMatch(id: string, j: any): ParsedMatch {
  const info = j.info;
  const people: Record<string, string> = info.registry?.people ?? {};
  const [team1, team2]: string[] = info.teams;
  const date: string = info.dates[0];
  const venueFull: string = info.venue ?? "Unknown";
  const venue = venueKey(venueFull);
  const season = String(info.season);

  const idOf = (name: string) => people[name] ?? `name:${name}`;
  const playerNames: Record<string, string> = {};
  const pool: { playerId: string; team: string; substitute: boolean }[] = [];
  const stats = new Map<string, Omit<PlayerMatchStat, "seq" | "d11">>();

  for (const team of [team1, team2]) {
    const opp = team === team1 ? team2 : team1;
    for (const name of info.players?.[team] ?? []) {
      const pid = idOf(name);
      playerNames[pid] = name;
      pool.push({ playerId: pid, team, substitute: false });
      stats.set(pid, blank(id, pid, name, team, opp, venue, date));
    }
  }
  const get = (name: string) => {
    const pid = idOf(name);
    let s = stats.get(pid);
    if (!s) {
      // listed in deliveries but not in the squad list (rare): attach to nobody-specific team
      s = blank(id, pid, name, "?", "?", venue, date);
      stats.set(pid, s);
      playerNames[pid] = name;
    }
    return s;
  };

  const inningsTotals: number[] = [];
  // Impact Players and concussion substitutes are recorded as replacements on the delivery where they come on
  const subNames = new Set<string>();
  for (const inn of j.innings ?? []) {
    if (inn.super_over) continue; // Dream11 ignores super overs
    let total = 0;
    const seenBatters: string[] = [];
    const bowlerOver = new Map<string, { legal: number; conceded: number }>();
    for (const over of inn.overs ?? []) {
      bowlerOver.clear();
      for (const d of over.deliveries ?? []) {
        for (const x of d.replacements?.match ?? []) {
          if (x.reason === "impact_player" || x.reason === "concussion_substitute") subNames.add(x.in);
        }
        const wides = d.extras?.wides ?? 0;
        const noballs = d.extras?.noballs ?? 0;
        total += d.runs.total ?? 0;

        for (const nm of [d.batter, d.non_striker]) {
          if (!seenBatters.includes(nm)) {
            seenBatters.push(nm);
            get(nm).batPos = seenBatters.length;
          }
        }

        const bat = get(d.batter);
        if (!wides) bat.balls += 1;
        const br = d.runs.batter ?? 0;
        bat.runs += br;
        if (!d.runs.non_boundary) {
          if (br === 4) bat.fours += 1;
          if (br === 6) bat.sixes += 1;
        }

        const bowl = get(d.bowler);
        const legal = !wides && !noballs;
        const conceded = br + wides + noballs;
        if (legal) bowl.ballsBowled += 1;
        bowl.runsConceded += conceded;
        const ov = bowlerOver.get(d.bowler) ?? { legal: 0, conceded: 0 };
        if (legal) ov.legal += 1;
        ov.conceded += conceded;
        bowlerOver.set(d.bowler, ov);

        for (const w of d.wickets ?? []) {
          const out = get(w.player_out);
          out.dismissed = true;
          const kind: string = w.kind;
          if (["caught", "bowled", "lbw", "stumped", "caught and bowled", "hit wicket"].includes(kind)) {
            bowl.wickets += 1;
            if (kind === "bowled" || kind === "lbw") bowl.lbwBowled += 1;
          }
          const fielders = (w.fielders ?? []).filter((f: any) => !f.substitute);
          if (kind === "caught" && fielders[0]) get(fielders[0].name).catches += 1;
          if (kind === "caught and bowled") bowl.catches += 1;
          if (kind === "stumped" && fielders[0]) get(fielders[0].name).stumpings += 1;
          if (kind === "run out") {
            if ((w.fielders ?? []).length === 1 && fielders.length === 1) get(fielders[0].name).roDirect += 1;
            else for (const f of fielders) get(f.name).roIndirect += 1;
          }
        }
      }
      for (const [nm, ov] of bowlerOver) {
        if (ov.legal === 6 && ov.conceded === 0) get(nm).maidens += 1;
      }
    }
    inningsTotals.push(total);
  }

  for (const p of pool) p.substitute = subNames.has(playerNames[p.playerId]);

  const outcome = info.outcome ?? {};
  let resultText: string | null = null;
  if (outcome.winner) {
    const by = outcome.by ?? {};
    const margin = by.runs ? `${by.runs} runs` : by.wickets ? `${by.wickets} wickets` : "";
    resultText = `${outcome.winner} won${margin ? " by " + margin : ""}`;
  } else if (outcome.result) {
    resultText = outcome.result;
  }

  const match: Omit<MatchRow, "seq"> = {
    id,
    season,
    matchNumber: info.event?.match_number ?? null,
    date,
    venue,
    venueFull,
    city: info.city ?? null,
    team1,
    team2,
    tossWinner: info.toss?.winner ?? null,
    tossDecision: info.toss?.decision ?? null,
    winner: outcome.winner ?? null,
    resultText,
    playerOfMatch: info.player_of_match?.[0] ?? null,
    inn1Runs: inningsTotals[0] ?? null,
    inn2Runs: inningsTotals[1] ?? null,
    isIpl2026: season === "2026",
  };

  return { match, stats: [...stats.values()].filter((s) => s.team !== "?"), playerNames, pool };
}
