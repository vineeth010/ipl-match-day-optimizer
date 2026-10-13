import { buildDatasetFromDir } from "../src/lib/dataset";
import { DEFAULT_WEIGHTS } from "../src/lib/config";
import { assertDateGate, DateGateError, predictPool } from "../src/lib/engine";
import { buildBestTeam, validateTeam } from "../src/lib/optimizer";
import { accuracyByMatch, learnFromObservations, type Observation } from "../src/lib/learning";
import type { PlayerMatchStat, WeightsConfig } from "../src/lib/types";

const dir = process.argv[2];
const maxMatches = Number(process.argv[3] ?? 74);
const ds = buildDatasetFromDir(dir);
const byPlayer = new Map<string, PlayerMatchStat[]>();
for (const s of ds.stats) (byPlayer.get(s.playerId) ?? byPlayer.set(s.playerId, []).get(s.playerId)!).push(s);
const matchById = new Map(ds.matches.map((m) => [m.id, m]));
const statKey = new Map(ds.stats.map((s) => [s.matchId + "|" + s.playerId, s]));

// ---- date gate must reject future evidence ----
const m3 = ds.matches.filter((m) => m.isIpl2026)[2];
try {
  assertDateGate({ target: m3, history: [ds.stats.find((s) => s.seq === m3.seq)!], venueMatches: [] });
  console.log("FAIL: gate accepted same-match evidence");
} catch (e) { console.log("date gate rejects same-match evidence:", e instanceof DateGateError); }

let weights: WeightsConfig = { ...DEFAULT_WEIGHTS, version: 1 };
const obs: Observation[] = [];
const ipl26 = ds.matches.filter((m) => m.isIpl2026).slice(0, maxMatches);
let invalid = 0, slowest = 0;
const trend: string[] = [];
for (const m of ipl26) {
  const pool = ds.pools.get(m.id)!.filter((p) => !p.substitute);
  const poolIds = new Set(pool.map((p) => p.playerId));
  const history: PlayerMatchStat[] = [];
  for (const id of poolIds) for (const s of byPlayer.get(id) ?? []) if (s.seq < m.seq) history.push(s);
  const venueMatches = ds.matches.filter((x) => x.venue === m.venue && x.seq < m.seq);
  const t0 = Date.now();
  const { predictions, venue } = predictPool({ target: m, pool, players: ds.players, history, venueMatches, rolePriors: ds.rolePriors, weights });
  const team = buildBestTeam(predictions);
  slowest = Math.max(slowest, Date.now() - t0);
  if (!team) { console.log("NO TEAM for", m.id); invalid++; continue; }
  const checks = validateTeam(team);
  if (checks.some((c) => !c.ok)) { invalid++; console.log("INVALID", m.id, checks.filter((c) => !c.ok)); }
  // Aryan "enters" the calculator's points for his 11 (raw, no multiplier)
  for (const p of team.players) {
    const actual = statKey.get(m.id + "|" + p.playerId)?.d11 ?? 0;
    const f = weights.factors;
    const base = f.form * p.factors.form + f.career * p.factors.career + f.venue * p.factors.venue + f.opp * p.factors.opp + f.role * p.factors.role;
    obs.push({ matchId: m.id, matchSeq: m.seq, playerId: p.playerId, name: p.name, role: p.role, venueType: venue.type, factors: p.factors, basePredicted: base, predicted: p.predicted, actual });
  }
  const res = learnFromObservations(weights, obs);
  if (res.changed) weights = res.after;
  const mm = ipl26.indexOf(m) + 1;
  if (mm <= 3 || mm % 10 === 0) trend.push(`match ${mm} (${m.team1} v ${m.team2}): team ${team.players.length}p cap ${team.captain.name} vc ${team.viceCaptain.name} exp ${team.expectedTotal} credits ${team.totalCredits} | cum MAE model ${res.modelMae} vs baseline ${res.baselineMae} | weights v${weights.version} ${JSON.stringify(weights.factors)} roleMult ${JSON.stringify(weights.roleMult)}\n   notes: ${res.notes.join(" | ")}`);
}
console.log(trend.join("\n"));
console.log("matches:", ipl26.length, "invalid teams:", invalid, "slowest generate ms:", slowest);
const acc = accuracyByMatch(obs);
const win = (a: number, b: number) => {
  const w = acc.slice(a, b); if (!w.length) return "n/a";
  const m = (k: "modelMae" | "baselineMae" | "bias" | "baselineBias") => (w.reduce((x, y) => x + y[k], 0) / w.length).toFixed(1);
  return `model MAE ${m("modelMae")} vs baseline ${m("baselineMae")} | model bias ${m("bias")} vs baseline bias ${m("baselineBias")}`;
};
console.log("matches 1-10 :", win(0, 10));
console.log("matches 11-30:", win(10, 30));
console.log("matches 31-74:", win(30, 74));
