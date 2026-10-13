/**
 * Season back-test: replays one IPL season match by match, exactly like the app does (date gate, predict, pick the XI,
 * "enter" the real points for the XI, learn), and measures how far predictions are from the real points.
 *
 *   npx tsx scripts/backtest.ts <cricsheet-json-dir> [season=2025] [out-csv]
 *
 * Two tracks run side by side so the effect of learning is visible:
 *   learning = weights updated after every match (the app's behaviour)
 *   frozen   = starting weights, never changed
 * Both are judged on all 22 players of each match (not only the XI), against the "career average" baseline.
 * Role priors use only matches before the season, so nothing from the season leaks into its own forecast.
 */
import fs from "node:fs";
import { buildDatasetFromDir } from "../src/lib/dataset";
import { DEFAULT_WEIGHTS } from "../src/lib/config";
import { predictPool } from "../src/lib/engine";
import { buildBestTeam } from "../src/lib/optimizer";
import { learnFromObservations, type Observation } from "../src/lib/learning";
import type { PlayerMatchStat, Role, WeightsConfig } from "../src/lib/types";

const dir = process.argv[2];
const season = process.argv[3] ?? "2025";
const outCsv = process.argv[4];
const ds = buildDatasetFromDir(dir);

const byPlayer = new Map<string, PlayerMatchStat[]>();
for (const s of ds.stats) (byPlayer.get(s.playerId) ?? byPlayer.set(s.playerId, []).get(s.playerId)!).push(s);
const statKey = new Map(ds.stats.map((s) => [s.matchId + "|" + s.playerId, s]));
const games = ds.matches.filter((m) => m.date.startsWith(season));
const seasonStart = games[0].date;

// role priors from before the season only
const sums: Record<Role, { t: number; n: number }> = { WK: { t: 0, n: 0 }, BAT: { t: 0, n: 0 }, AR: { t: 0, n: 0 }, BOWL: { t: 0, n: 0 } };
for (const s of ds.stats) if (s.date < seasonStart) { const r = ds.players.get(s.playerId)?.role ?? "BAT"; sums[r].t += s.d11; sums[r].n++; }
const rolePriors = Object.fromEntries((Object.keys(sums) as Role[]).map((r) => [r, sums[r].n ? sums[r].t / sums[r].n : 25])) as Record<Role, number>;

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const corr = (x: number[], y: number[]) => {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
};

let learned: WeightsConfig = { ...DEFAULT_WEIGHTS, version: 1 };
const frozen: WeightsConfig = { ...DEFAULT_WEIGHTS, version: 1 };
const obs: Observation[] = [];

interface Row { n: number; lMae: number; fMae: number; bMae: number; lBias: number; bBias: number; lR: number; bR: number; xiMae: number; xiExp: number; xiAct: number; ver: number }
const rows: Row[] = [];
const roleOnly: number[] = [];
const cap = { n: 0, beat: 0, vcBeat: 0, randomBeat: 0 };

games.forEach((m, idx) => {
  const pool = (ds.pools.get(m.id) ?? []).filter((p) => !p.substitute);
  const history: PlayerMatchStat[] = [];
  for (const p of pool) for (const s of byPlayer.get(p.playerId) ?? []) if (s.seq < m.seq) history.push(s);
  const venueMatches = ds.matches.filter((x) => x.venue === m.venue && x.seq < m.seq);
  const base = { target: m, pool, players: ds.players, history, venueMatches, rolePriors };
  const L = predictPool({ ...base, weights: learned });
  const F = predictPool({ ...base, weights: frozen });
  const fById = new Map(F.predictions.map((p) => [p.playerId, p.predicted]));

  const act = L.predictions.map((p) => statKey.get(m.id + "|" + p.playerId)?.d11 ?? 0);
  const lp = L.predictions.map((p) => p.predicted);
  const fp = L.predictions.map((p) => fById.get(p.playerId) ?? 0);
  const bp = L.predictions.map((p) => p.factors.career);
  const abs = (a: number[], b: number[]) => mean(a.map((v, i) => Math.abs(v - b[i])));
  const bias = (a: number[], b: number[]) => mean(a.map((v, i) => v - b[i]));

  roleOnly.push(abs(L.predictions.map((p) => p.factors.role), act));
  const team = buildBestTeam(L.predictions);
  let xiMae = 0, xiExp = 0, xiAct = 0;
  const actuals11: number[] = [];
  if (team) {
    for (const p of team.players) {
      const actual = statKey.get(m.id + "|" + p.playerId)?.d11 ?? 0;
      const f = learned.factors;
      const basePredicted = f.form * p.factors.form + f.career * p.factors.career + f.venue * p.factors.venue + f.opp * p.factors.opp + f.role * p.factors.role;
      obs.push({ matchId: m.id, matchSeq: m.seq, playerId: p.playerId, name: p.name, role: p.role, venueType: L.venue.type, factors: p.factors, basePredicted, predicted: p.predicted, actual });
      xiMae += Math.abs(actual - p.predicted) / team.players.length;
      actuals11.push(actual);
      xiExp += p.predicted * (p.playerId === team.captain.playerId ? 2 : p.playerId === team.viceCaptain.playerId ? 1.5 : 1);
      xiAct += actual * (p.playerId === team.captain.playerId ? 2 : p.playerId === team.viceCaptain.playerId ? 1.5 : 1);
    }
  }
  if (team) {
    const avg = mean(actuals11);
    const a = (id: string) => statKey.get(m.id + "|" + id)?.d11 ?? 0;
    cap.n++;
    if (a(team.captain.playerId) > avg) cap.beat++;
    if (a(team.viceCaptain.playerId) > avg) cap.vcBeat++;
    cap.randomBeat += actuals11.filter((v) => v > avg).length / actuals11.length;
  }
  rows.push({ n: idx + 1, lMae: abs(lp, act), fMae: abs(fp, act), bMae: abs(bp, act), lBias: bias(lp, act), bBias: bias(bp, act), lR: corr(lp, act), bR: corr(bp, act), xiMae, xiExp, xiAct, ver: learned.version });
  const res = learnFromObservations(learned, obs);
  if (res.changed) learned = res.after;
});

const win = (a: number, b: number) => {
  const w = rows.slice(a, b);
  const f = (k: keyof Row) => mean(w.map((r) => r[k] as number)).toFixed(2);
  return `${String(a + 1).padStart(2)}-${String(Math.min(b, rows.length)).padStart(2)} | learning ${f("lMae")} | frozen ${f("fMae")} | baseline ${f("bMae")} | bias ${f("lBias")} (baseline ${f("bBias")}) | corr ${f("lR")} (baseline ${f("bR")}) | XI MAE ${f("xiMae")} | weights v${w[w.length - 1].ver}`;
};
console.log(`Season ${season}: ${rows.length} matches, role priors from ${sums.WK.n + sums.BAT.n + sums.AR.n + sums.BOWL.n} earlier player-matches`);
console.log("matches | pool MAE: learning vs frozen vs baseline | bias | correlation");
for (let a = 0; a < rows.length; a += 10) console.log(win(a, a + 10));
console.log("ALL   ", win(0, rows.length));
console.log(`captain beat his XI average in ${cap.beat} of ${cap.n} matches (${(100 * cap.beat / cap.n).toFixed(0)}%); vice-captain ${cap.vcBeat} (${(100 * cap.vcBeat / cap.n).toFixed(0)}%); a blind pick from the 11 would manage ${(100 * cap.randomBeat / cap.n).toFixed(0)}%`);
console.log(`role-average-only guess (no player info): pool MAE ${mean(roleOnly).toFixed(2)}`);
console.log("final weights:", JSON.stringify(learned.factors), "roleMult", JSON.stringify(learned.roleMult), "venueMult", JSON.stringify(learned.venueMult));
const tot = (k: keyof Row) => rows.reduce((s, r) => s + (r[k] as number), 0);
console.log(`XI team (with C/VC): mean expected ${(tot("xiExp") / rows.length).toFixed(0)} vs mean actual ${(tot("xiAct") / rows.length).toFixed(0)}`);
if (outCsv) {
  fs.writeFileSync(outCsv, ["match,learning_mae,frozen_mae,baseline_mae,learning_bias,baseline_bias,learning_corr,baseline_corr,xi_mae,xi_expected,xi_actual,weights_version", ...rows.map((r) => [r.n, r.lMae, r.fMae, r.bMae, r.lBias, r.bBias, r.lR, r.bR, r.xiMae, r.xiExp, r.xiAct, r.ver].map((v) => (typeof v === "number" ? +v.toFixed(3) : v)).join(","))].join("\n"));
  console.log("wrote", outCsv);
}
