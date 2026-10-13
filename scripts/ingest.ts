/**
 * Ingestion job: runs ahead of time (and again after each match is played).
 * Downloads the public Cricsheet IPL archive, parses every match, computes Dream11 points for every player
 * in every match, and loads everything into Supabase stamped with its match date and sequence number.
 * Usage: npm run ingest            (downloads fresh data from cricsheet.org)
 *        npm run ingest -- <dir>   (reuse an already-extracted folder of Cricsheet JSON files)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import dotenv from "dotenv";
import { DEFAULT_WEIGHTS } from "../src/lib/config";
import { buildDatasetFromDir } from "../src/lib/dataset";

dotenv.config({ path: ".env.local" });

const URL = "https://cricsheet.org/downloads/ipl_male_json.zip";

async function download(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdo-cricsheet-"));
  console.log("downloading", URL);
  const res = await fetch(URL, { headers: { "user-agent": "match-day-optimizer-student-project" } });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`downloaded ${(buf.length / 1e6).toFixed(1)} MB`);
  new AdmZip(buf).extractAllTo(dir, true);
  return dir;
}

async function main() {
  const { db, upsertBatched, saveWeights } = await import("../src/lib/db");
  const dir = process.argv[2] ?? (await download());
  const ds = buildDatasetFromDir(dir);
  console.log(`parsed ${ds.matches.length} matches, ${ds.stats.length} player-match rows, ${ds.players.size} players`);

  // keep roles that Gemini already classified (re-running the classifier could answer differently and change picks)
  const aiIds = new Set(((await db().from("md_players").select("id").eq("role_source", "ai")).data ?? []).map((r: { id: string }) => r.id));
  await upsertBatched(
    "md_players",
    [...ds.players.values()].filter((p) => !aiIds.has(p.id)).map((p) => ({ id: p.id, name: p.name, role: p.role, role_source: p.roleSource })),
    "id",
  );
  console.log("players loaded");

  await upsertBatched(
    "md_matches",
    ds.matches.map((m) => ({
      id: m.id, seq: m.seq, season: m.season, match_number: m.matchNumber, match_date: m.date, venue: m.venue, venue_full: m.venueFull, city: m.city,
      team1: m.team1, team2: m.team2, toss_winner: m.tossWinner, toss_decision: m.tossDecision, winner: m.winner, result_text: m.resultText,
      player_of_match: m.playerOfMatch, inn1_runs: m.inn1Runs, inn2_runs: m.inn2Runs, is_ipl2026: m.isIpl2026,
    })),
    "id",
  );
  console.log("matches loaded");

  // The pool is each side's STARTING XI only. Impact Players / concussion substitutes are out of scope: they are not pool
  // members, and are recorded in md_meta ('impact_players') so a match page can mention them after the match.
  const pools: object[] = [];
  const impact: Record<string, { playerId: string; team: string }[]> = {};
  const stale: { match_id: string; player_id: string }[] = [];
  for (const [matchId, pool] of ds.pools) {
    for (const p of pool) {
      if (p.substitute) {
        (impact[matchId] ??= []).push({ playerId: p.playerId, team: p.team });
        stale.push({ match_id: matchId, player_id: p.playerId });
      } else pools.push({ match_id: matchId, player_id: p.playerId, team: p.team });
    }
  }
  await upsertBatched("md_match_players", pools, "match_id,player_id");
  for (const x of stale) {
    const { error: delErr } = await db().from("md_match_players").delete().eq("match_id", x.match_id).eq("player_id", x.player_id);
    if (delErr) throw new Error(delErr.message);
  }
  const { error: impErr } = await db().from("md_meta").upsert({ key: "impact_players", value: impact }, { onConflict: "key" });
  if (impErr) throw new Error(impErr.message);
  console.log(`match squads loaded (${pools.length} starting-XI rows; ${stale.length} impact/substitute players left out)`);

  await upsertBatched(
    "md_player_stats",
    ds.stats.map((s) => ({
      match_id: s.matchId, player_id: s.playerId, team: s.team, opponent: s.opponent, venue: s.venue, match_date: s.date, seq: s.seq,
      bat_pos: s.batPos, runs: s.runs, balls: s.balls, fours: s.fours, sixes: s.sixes, dismissed: s.dismissed, balls_bowled: s.ballsBowled,
      runs_conceded: s.runsConceded, wickets: s.wickets, lbw_bowled: s.lbwBowled, maidens: s.maidens, catches: s.catches, stumpings: s.stumpings,
      ro_direct: s.roDirect, ro_indirect: s.roIndirect, d11: s.d11 ?? 0,
    })),
    "match_id,player_id",
  );
  console.log("player stats loaded");

  const { error } = await db().from("md_meta").upsert({ key: "role_priors", value: ds.rolePriors }, { onConflict: "key" });
  if (error) throw new Error(error.message);

  const { data: w } = await db().from("md_weights").select("version").limit(1);
  if (!w?.length) await saveWeights({ ...DEFAULT_WEIGHTS, version: 1 });
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
