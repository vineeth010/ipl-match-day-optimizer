/**
 * Computes the IPL points scale and the record performance for each role from the stored history, and saves it to
 * md_meta ('points_scale') so the app can show it. Usage: npm run points-scale
 */
import dotenv from "dotenv";
import { summarise, type Performance, type PointsScale } from "../src/lib/scale";

dotenv.config({ path: ".env.local", quiet: true });

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const { db } = await import("../src/lib/db");
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("md_player_stats").select("match_id,player_id,team,opponent,match_date,d11,runs,balls,wickets,catches,stumpings").order("match_id").order("player_id").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const players = new Map<string, { name: string; role: string }>();
  const ids = [...new Set(rows.map((r) => r.player_id))];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db().from("md_players").select("id,name,role").in("id", ids.slice(i, i + 200));
    for (const p of data ?? []) players.set(p.id, { name: p.name, role: p.role });
  }
  const perf = (r: any): Performance => ({ player: players.get(r.player_id)?.name ?? r.player_id, playerId: r.player_id, role: players.get(r.player_id)?.role ?? "BAT", team: r.team, opponent: r.opponent, date: r.match_date, points: Number(r.d11), summary: summarise(r) });
  const sorted = [...rows].sort((a, b) => Number(b.d11) - Number(a.d11));
  const vals = rows.map((r) => Number(r.d11)).sort((a, b) => a - b);
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  const first = (f: (r: any) => boolean) => perf(sorted.find(f)!);
  const batterRow = sorted.find((r) => r.runs >= 50 && r.wickets <= 2)!;
  const share = (x: number) => vals.filter((v) => v > x).length / vals.length;
  const seasons = rows.map((r) => String(r.match_date).slice(0, 4)).sort();
  const scale: PointsScale = {
    rows: rows.length,
    firstSeason: seasons[0],
    lastSeason: seasons[seasons.length - 1],
    min: vals[0],
    median: q(0.5),
    p90: q(0.9),
    p99: q(0.99),
    max: perf(sorted[0]),
    records: {
      batter: first((r) => r.runs >= 50 && r.wickets <= 2),
      bowler: first((r) => r.runs <= 20 && r.wickets >= 3),
      allRounder: first((r) => r.runs >= 30 && r.wickets >= 3 && r.player_id !== batterRow.player_id),
      keeper: first((r) => players.get(r.player_id)?.role === "WK"),
    },
    top5: sorted.slice(0, 5).map(perf),
    share: { above100: share(100), above150: share(150), above200: share(200) },
  };
  const { error } = await db().from("md_meta").upsert({ key: "points_scale", value: scale }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  console.log(`saved points scale from ${rows.length} player-matches`);
  console.log("overall:", scale.max.player, scale.max.points, scale.max.summary, scale.max.date);
  for (const k of ["batter", "bowler", "allRounder", "keeper"] as const) console.log(k.padEnd(11), scale.records[k].player.padEnd(18), String(scale.records[k].points).padStart(4), scale.records[k].summary, "|", scale.records[k].date, scale.records[k].team);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
