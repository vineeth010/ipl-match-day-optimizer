import { buildDatasetFromDir } from "../src/lib/dataset";
const dir = process.argv[2];
const t0 = Date.now();
const ds = buildDatasetFromDir(dir);
console.log("built in", Date.now() - t0, "ms;", ds.matches.length, "matches,", ds.stats.length, "stat rows,", ds.players.size, "players");
console.log("role priors", ds.rolePriors);
const dist: Record<string, number> = {};
for (const p of ds.players.values()) dist[p.role + ":" + p.roleSource] = (dist[p.role + ":" + p.roleSource] ?? 0) + 1;
console.log("role distribution", dist);
const m1 = ds.matches.find((m) => m.isIpl2026)!;
console.log("first 2026 match", m1.id, m1.seq, m1.date, m1.team1, "v", m1.team2, m1.venue, "|", m1.resultText, "| POM", m1.playerOfMatch, "| inn", m1.inn1Runs, m1.inn2Runs);
const rows = ds.stats.filter((s) => s.matchId === m1.id).sort((a, b) => (b.d11 ?? 0) - (a.d11 ?? 0));
for (const r of rows.slice(0, 8)) console.log(r.playerName.padEnd(22), ds.players.get(r.playerId)!.role.padEnd(4), String(r.d11).padStart(5), `${r.runs}(${r.balls}) ${r.wickets}w ${r.ballsBowled}b/${r.runsConceded}r c${r.catches}`);
// well known names
for (const n of ["MS Dhoni", "V Kohli", "JJ Bumrah", "HH Pandya", "RA Jadeja", "Rashid Khan", "RR Pant", "SV Samson", "Abhishek Sharma", "Suyash Sharma", "KH Pandya"]) {
  const p = [...ds.players.values()].find((x) => x.name === n);
  console.log(n.padEnd(18), p ? p.role + "/" + p.roleSource : "n/a");
}
// leak sanity: seq strictly increasing in date
let bad = 0; for (let i = 1; i < ds.matches.length; i++) if (ds.matches[i].date < ds.matches[i - 1].date) bad++;
console.log("date order violations:", bad);
// venue scoring spread
const v: Record<string, number[]> = {};
for (const m of ds.matches) if (m.inn1Runs) (v[m.venue] ??= []).push(m.inn1Runs);
const avgs = Object.entries(v).filter(([, a]) => a.length >= 20).map(([k, a]) => [k, Math.round(a.reduce((x, y) => x + y, 0) / a.length), a.length] as const).sort((a, b) => b[1] - a[1]);
console.log(avgs.slice(0, 5), avgs.slice(-5));
