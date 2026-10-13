/**
 * Entry workbook (Excel), outside the app.
 *
 * Replays the app's own pipeline match by match (same database code, same prediction / team / learning functions),
 * entering the scorecard-derived points after every match, and writes one Excel workbook:
 *   Read me · Entry sheet (the exact XI per match + points to type in) · Match totals (formulas) ·
 *   Points ceiling (what the scale can and cannot reach) · All players' points (fallback if you go off-sheet)
 *
 * Usage: npm run entry-xlsx            (all 74 matches)
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import ExcelJS from "exceljs";

dotenv.config({ path: ".env.local", quiet: true });

/* eslint-disable @typescript-eslint/no-explicit-any */
const FONT = "Arial";
const GREEN = "FF0B6B4F";
const YELLOW = "FFFFFF00";

async function main() {
  const { db, listIplMatches, loadEvidence } = await import("../src/lib/db");
  const { DEFAULT_WEIGHTS, LEARNING } = await import("../src/lib/config");
  const { predictPool } = await import("../src/lib/engine");
  const { buildBestTeam } = await import("../src/lib/optimizer");
  const { learnFromObservations } = await import("../src/lib/learning");
  const { dream11Points } = await import("../src/lib/dream11");

  const matches = await listIplMatches();

  // ---------- 1. replay the app pipeline ----------
  let weights: any = { ...DEFAULT_WEIGHTS, version: 1 };
  const observations: any[] = [];
  type Row = { matchNo: number; date: string; label: string; player: string; team: string; role: string; cvc: string; predicted: number; actual: number; parts: string };
  const rows: Row[] = [];
  const poolPreds: number[] = [];
  const teamTotals: number[] = [];
  for (const [i, m] of matches.entries()) {
    const evidence = await loadEvidence(m, weights);
    const { predictions, venue } = predictPool({ ...evidence, weights } as any);
    for (const p of predictions) poolPreds.push(p.predicted);
    const team = buildBestTeam(predictions);
    if (!team) throw new Error(`no team for match ${m.matchNumber}`);
    teamTotals.push(team.expectedTotal);
    const ids = team.players.map((p) => p.playerId);
    const { data } = await db().from("md_player_stats").select("*").eq("match_id", m.id).in("player_id", ids);
    const statBy = new Map((data ?? []).map((r: any) => [r.player_id, r]));
    const f = weights.factors;
    for (const p of team.players) {
      const row: any = statBy.get(p.playerId);
      const actual = row ? Number(row.d11) : 0;
      let parts = row ? "" : "did not play";
      if (row) {
        const stat = { runs: row.runs, balls: row.balls, fours: row.fours, sixes: row.sixes, dismissed: row.dismissed, ballsBowled: row.balls_bowled, runsConceded: row.runs_conceded, wickets: row.wickets, lbwBowled: row.lbw_bowled, maidens: row.maidens, catches: row.catches, stumpings: row.stumpings, roDirect: row.ro_direct, roIndirect: row.ro_indirect };
        for (const role of [p.role, "BAT", "BOWL", "AR", "WK"] as const) {
          const r = dream11Points(stat, role);
          if (r.total === actual) {
            parts = Object.entries(r.parts).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join("; ");
            break;
          }
        }
      }
      const cvc = p.playerId === team.captain.playerId ? "C" : p.playerId === team.viceCaptain.playerId ? "VC" : "";
      rows.push({ matchNo: m.matchNumber ?? i + 1, date: m.date, label: `${m.team1} v ${m.team2}`, player: p.name, team: p.team, role: p.role, cvc, predicted: p.predicted, actual, parts });
      const base = f.form * p.factors.form + f.career * p.factors.career + f.venue * p.factors.venue + f.opp * p.factors.opp + f.role * p.factors.role;
      observations.push({ matchId: m.id, matchSeq: m.seq, playerId: p.playerId, name: p.name, role: p.role, venueType: venue.type, factors: p.factors, basePredicted: base, predicted: p.predicted, actual });
    }
    const res = learnFromObservations(weights, observations);
    if (res.changed) weights = res.after;
    process.stdout.write(`\rreplay ${i + 1}/${matches.length}`);
  }
  console.log();

  // ---------- 2. the actual-points scale, from every stored player-match ----------
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("md_player_stats").select("match_id,player_id,d11,runs,balls,wickets,catches,match_date,seq,team,opponent").order("match_id").order("player_id").range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  // the scale only uses seasons already played in the app's timeline (up to 2025); 2026 is the season being replayed
  const hist = all.filter((r) => String(r.match_date) < "2026-01-01");
  const vals = hist.map((r) => Number(r.d11)).sort((a, b) => a - b);
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  const best = hist.reduce((a, b) => (Number(b.d11) > Number(a.d11) ? b : a));
  const { data: bestName } = await db().from("md_players").select("name").eq("id", best.player_id).single();
  const firstSeq2026 = matches[0].seq;
  const byPlayer = new Map<string, number[]>();
  for (const r of hist) if (r.seq < firstSeq2026) (byPlayer.get(r.player_id) ?? byPlayer.set(r.player_id, []).get(r.player_id)!).push(Number(r.d11));
  let topAvg = { id: "", avg: 0, n: 0 };
  for (const [id, a] of byPlayer) if (a.length >= 30) { const avg = a.reduce((x, y) => x + y, 0) / a.length; if (avg > topAvg.avg) topAvg = { id, avg, n: a.length }; }
  const { data: topAvgName } = await db().from("md_players").select("name").eq("id", topAvg.id).single();
  const above = (x: number) => vals.filter((v) => v > x).length / vals.length;

  // ---------- 3. all IPL 2026 players' points (fallback sheet) ----------
  const seqSet = new Map(matches.map((m) => [m.id, m]));
  const idsOf2026 = new Set(matches.map((m) => m.id));
  const impactMeta = ((await db().from("md_meta").select("value").eq("key", "impact_players").maybeSingle()).data as any)?.value ?? {};
  const isImpact = (matchId: string, playerId: string) => ((impactMeta[matchId] ?? []) as { playerId: string }[]).some((x) => x.playerId === playerId);
  const pts2026Raw = all.filter((r) => idsOf2026.has(r.match_id));
  const pts2026 = pts2026Raw.filter((r) => !isImpact(r.match_id, r.player_id)); // the 22 starters
  const impactRows = pts2026Raw.filter((r) => isImpact(r.match_id, r.player_id));
  const pids = [...new Set(pts2026Raw.map((r) => r.player_id))];
  const nameBy = new Map<string, string>();
  const roleBy = new Map<string, string>();
  for (let i = 0; i < pids.length; i += 200) {
    const { data } = await db().from("md_players").select("id,name,role").in("id", pids.slice(i, i + 200));
    for (const p of data ?? []) { nameBy.set(p.id, p.name); roleBy.set(p.id, p.role); }
  }

  // ---------- 4. workbook ----------
  const wb = new ExcelJS.Workbook();
  wb.creator = "Match Day Optimizer";
  const style = (cell: ExcelJS.Cell, o: Partial<ExcelJS.Style> = {}) => { cell.font = { name: FONT, size: 10, ...(o.font ?? {}) }; if (o.fill) cell.fill = o.fill; if (o.alignment) cell.alignment = o.alignment; if (o.border) cell.border = o.border; if (o.numFmt) cell.numFmt = o.numFmt; };
  const header = (ws: ExcelJS.Worksheet, rowNo: number) => {
    const r = ws.getRow(rowNo);
    r.height = 30;
    r.eachCell((c) => style(c, { font: { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } }, alignment: { vertical: "middle", horizontal: "center", wrapText: true } }));
  };

  // ----- Read me -----
  const rm = wb.addWorksheet("Read me", { views: [{ showGridLines: false }] });
  rm.columns = [{ width: 3 }, { width: 30 }, { width: 100 }];
  const put = (r: number, a: string, b = "", o: { bold?: boolean; size?: number; fill?: string } = {}) => {
    const ca = rm.getCell(r, 2), cb = rm.getCell(r, 3);
    ca.value = a; cb.value = b;
    style(ca, { font: { name: FONT, size: o.size ?? 10, bold: o.bold ?? true } , alignment: { vertical: "top", wrapText: true } });
    style(cb, { font: { name: FONT, size: 10 }, alignment: { vertical: "top", wrapText: true } });
    if (o.fill) { ca.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } }; cb.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } }; }
  };
  put(1, "Match Day Optimizer: IPL 2026 entry workbook", "", { size: 14 });
  put(3, "What this is", "For every IPL 2026 match, the exact 11 players the app will recommend, with the real Dream11 points to type into the app after the match. The points come from the official scorecard, scored with Dream11's T20 table.");
  put(4, "How to use it", "1) In the app, open match 1 and click Generate team.  2) Find match 1 in the 'Entry sheet' tab and check the XI matches.  3) After 'playing' the match, type each player's yellow 'Points to enter' value into the app (plain points: the app adds the 2x / 1.5x itself).  4) Click Save, then move on to match 2.");
  put(5, "Why the order matters", "The agent learns from what you enter, so its picks for match N depend on matches 1 to N-1. This workbook was built by replaying the app match by match with exactly these numbers, and checked against the live app for matches 1 to 4 (identical XI and captain picks). If you enter different numbers, or skip a match, later XIs can differ: use the 'All players points' tab, which lists everyone.");
  put(6, "Colour legend", "Yellow cells with blue text = the values you type into the app. Everything else is read-only information or a formula.");
  put(7, "Tabs", "Entry sheet · Match totals (formulas) · Points ceiling (what the scale can and cannot reach) · All players points (the 22 starters, fallback) · Impact subs (not pickable).");
  put(10, "Scope assumption", "Each match uses the 11 starters of each side (22 players). The Impact Player rule is out of scope for now: substitutes who came on are never in the pool and are listed only in the 'Impact subs (not pickable)' tab, for context.");
  put(8, "Example row (match 1)", "H Klaasen · WK · Captain · Predicted 58.8 · Points to enter 61  (Playing XI +4; Runs +31; Boundary bonus +2; Six bonus +2; 30-run bonus +4; ...)");
  put(9, "Assumptions & sources", "Scoring table: Dream11's T20 points table as implemented in src/lib/dream11.ts, checked against two published guides (Sportskeeda, May 2021; psainath.org). Dream11's own points page was unreachable when checked, so it is not confirmed against Dream11 itself. Unconfirmed: the stumping value (+12 assumed) and whether the 30/50/100-run bonuses stack (highest only assumed). Scorecards: Cricsheet ball-by-ball IPL data (cricsheet.org, CC BY 3.0). Credits are estimated, not Dream11's own. Predicted values are the app's expected points per player (see 'Points ceiling').");
  for (const r of [3, 4, 5, 6, 7, 8, 9, 10]) rm.getRow(r).height = r === 4 || r === 5 || r === 9 || r === 10 ? 62 : 36;

  // ----- Entry sheet -----
  const es = wb.addWorksheet("Entry sheet", { views: [{ state: "frozen", ySplit: 1 }] });
  es.columns = [
    { header: "Match #", width: 9 }, { header: "Date", width: 12 }, { header: "Match", width: 44 }, { header: "Player", width: 22 }, { header: "Team", width: 30 },
    { header: "Role", width: 8 }, { header: "Captain / VC", width: 11 }, { header: "Predicted (app shows)", width: 14 }, { header: "Points to enter", width: 13 },
    { header: "Multiplier", width: 11 }, { header: "Predicted counted in team total", width: 14 }, { header: "Points counted in team total", width: 14 }, { header: "How the points were scored", width: 90 },
  ];
  header(es, 1);
  rows.forEach((r, i) => {
    const n = i + 2;
    const row = es.addRow([r.matchNo, r.date, r.label, r.player, r.team, r.role, r.cvc, r.predicted, r.actual, { formula: `IF(G${n}="C",2,IF(G${n}="VC",1.5,1))`, result: r.cvc === "C" ? 2 : r.cvc === "VC" ? 1.5 : 1 }, { formula: `H${n}*J${n}`, result: r.predicted * (r.cvc === "C" ? 2 : r.cvc === "VC" ? 1.5 : 1) }, { formula: `I${n}*J${n}`, result: r.actual * (r.cvc === "C" ? 2 : r.cvc === "VC" ? 1.5 : 1) }, r.parts]);
    const band = r.matchNo % 2 === 0 ? "FFF3F7F4" : "FFFFFFFF";
    row.eachCell((c, col) => {
      style(c, { fill: { type: "pattern", pattern: "solid", fgColor: { argb: band } }, alignment: { vertical: "middle" } });
      if (col === 8) c.numFmt = "0.0";
      if (col === 7 && r.cvc) c.font = { name: FONT, size: 10, bold: true };
    });
    const c = row.getCell(9);
    style(c, { font: { name: FONT, size: 10, bold: true, color: { argb: "FF0000FF" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } }, alignment: { horizontal: "center" } });
  });
  es.autoFilter = { from: "A1", to: `M${rows.length + 1}` };
  const lastEs = rows.length + 1;

  // ----- Match totals -----
  const mt = wb.addWorksheet("Match totals", { views: [{ state: "frozen", ySplit: 1 }] });
  mt.columns = [{ header: "Match #", width: 9 }, { header: "Match", width: 44 }, { header: "Expected team total (with C / VC)", width: 20 }, { header: "Actual team total (with C / VC)", width: 20 }, { header: "Gap (actual - expected)", width: 18 }, { header: "Gap per player", width: 14 }];
  header(mt, 1);
  const matchNos = [...new Set(rows.map((r) => r.matchNo))];
  matchNos.forEach((no, i) => {
    const n = i + 2;
    const mine = rows.filter((r) => r.matchNo === no);
    const mult = (r: Row) => (r.cvc === "C" ? 2 : r.cvc === "VC" ? 1.5 : 1);
    const exp = mine.reduce((a, r) => a + r.predicted * mult(r), 0);
    const act = mine.reduce((a, r) => a + r.actual * mult(r), 0);
    const row = mt.addRow([no, mine[0].label,
      { formula: `SUMIFS('Entry sheet'!$K$2:$K${lastEs},'Entry sheet'!$A$2:$A${lastEs},A${n})`, result: exp },
      { formula: `SUMIFS('Entry sheet'!$L$2:$L${lastEs},'Entry sheet'!$A$2:$A${lastEs},A${n})`, result: act },
      { formula: `D${n}-C${n}`, result: act - exp },
      { formula: `E${n}/11`, result: (act - exp) / 11 }]);
    row.eachCell((c, col) => { style(c); if (col >= 3) c.numFmt = "0.0;[Red]-0.0"; });
  });

  // ----- Points ceiling -----
  const pc = wb.addWorksheet("Points ceiling", { views: [{ showGridLines: false }] });
  pc.columns = [{ width: 3 }, { width: 52 }, { width: 18 }, { width: 80 }];
  let r = 1;
  const title = (t: string) => { pc.getCell(r, 2).value = t; style(pc.getCell(r, 2), { font: { name: FONT, size: 12, bold: true, color: { argb: GREEN } } }); r++; };
  const line = (a: string, b: string | number | { formula: string; result: number }, c = "", fmt?: string) => {
    pc.getCell(r, 2).value = a; pc.getCell(r, 3).value = b as any; pc.getCell(r, 4).value = c;
    style(pc.getCell(r, 2), { alignment: { wrapText: true, vertical: "top" } });
    style(pc.getCell(r, 3), { alignment: { horizontal: "right", vertical: "top" }, numFmt: fmt });
    style(pc.getCell(r, 4), { alignment: { wrapText: true, vertical: "top" } });
    r++;
  };
  title("Points ceiling: what the scale can and cannot reach");
  r++;
  title("A. ACTUAL points (what a player really scores in one match)");
  line("Is there a hard cap in the rules?", "No", "Dream11 does not cap runs, wickets or catches, so there is no formal maximum.");
  line("Lowest ever (IPL 2008-2025)", vals[0], `Across ${vals.length.toLocaleString()} player appearances, scored with our Dream11 table. Source: Cricsheet scorecards.`);
  line("Typical (median)", q(0.5), "Half of all appearances score this or less.");
  line("Top 10% start at", q(0.9), "");
  line("Top 1% start at", q(0.99), "");
  line("Highest ever", Number(best.d11), `${bestName?.name ?? ""}: ${best.runs} off ${best.balls} balls, ${best.wickets} wickets (${best.match_date}). The practical ceiling for one player in one match so far.`);
  line("Share of appearances above 100", above(100), "", "0.0%");
  line("Share of appearances above 150", above(150), "", "0.00%");
  line("Share of appearances above 200", above(200), "", "0.000%");
  line("As captain (2x) the highest ever would count", { formula: "C9*2", result: Number(best.d11) * 2 }, "Captain doubles, vice-captain is 1.5x. Rare, but this is how contests are won.");
  r++;
  title("B. PREDICTED points (what the agent expects a player to score)");
  line("What a prediction is", "Expectation", "A weighted AVERAGE of the player's past points (recent form, career, this ground, this opponent, role), times small multipliers. It is the points the agent expects on a normal day, not the best day he could have.");
  line("Why it has a ceiling", "Averages", "A weighted average of past scores can never exceed the best past scores it is built from, and the multipliers are capped (0.8 to 1.2 each). So predictions are always far below peak scores.");
  line("Highest career average of any IPL player (30+ matches, before 2026)", Number(topAvg.avg.toFixed(1)), `${topAvgName?.name ?? ""}, over ${topAvg.n} matches. Predictions sit near the best players' averages. Recent form can lift one a little above this (see the highest prediction below), but never towards peak scores.`, "0.0");
  line("Strict mathematical limit of one prediction", { formula: "C9*1.2*1.2", result: Number(best.d11) * 1.44 }, "Absolute worst case: highest score ever (C9) in every factor, with both multipliers at their 1.2 cap. Never approached in practice.", "0.0");
  line("Highest prediction actually produced (whole replay, any player)", Number(Math.max(...poolPreds).toFixed(1)), `Across all 74 matches, every player in every pool (${poolPreds.length} predictions). Computed by replaying the app.`, "0.0");
  line("Lowest prediction actually produced", Number(Math.min(...poolPreds).toFixed(1)), "Debutants with no history sit near this floor.", "0.0");
  line("Highest predicted score among players the agent PICKED", { formula: `MAX('Entry sheet'!H2:H${lastEs})`, result: Math.max(...rows.map((x) => x.predicted)) }, "Formula over the Entry sheet.", "0.0");
  line("Lowest predicted score among players the agent PICKED", { formula: `MIN('Entry sheet'!H2:H${lastEs})`, result: Math.min(...rows.map((x) => x.predicted)) }, "Formula over the Entry sheet.", "0.0");
  line("Team expected total (with C / VC): lowest match", { formula: `MIN('Match totals'!C2:C${matchNos.length + 1})`, result: Math.min(...teamTotals) }, "Sum of 11 predictions + captain's extra 1x + vice-captain's extra 0.5x.", "0.0");
  line("Team expected total (with C / VC): highest match", { formula: `MAX('Match totals'!C2:C${matchNos.length + 1})`, result: Math.max(...teamTotals) }, "", "0.0");
  line("Team expected total: average", { formula: `AVERAGE('Match totals'!C2:C${matchNos.length + 1})`, result: teamTotals.reduce((a, b) => a + b, 0) / teamTotals.length }, "", "0.0");
  r++;
  title("C. How the agent is judged (so the ceiling does not matter)");
  line("What is measured", "Gap", "The gap between predicted and actual points, match after match, next to a simple baseline ('each player scores his career average'). Not whether the agent predicts peaks.");
  line("How much evidence before it changes anything", LEARNING.minObsForAnyChange, "Entries needed (two matches) before any weight moves; one match is mostly luck.");
  r++;
  title("Say this in the viva");
  pc.getCell(r, 2).value = "\"Dream11 has no cap on points. In 18 IPL seasons (2008 to 2025) the highest single score was " + Number(best.d11) + ". Our agent predicts expected points, a weighted average, so its predictions run about " + Math.round(Math.min(...poolPreds)) + " to " + Math.round(Math.max(...poolPreds)) + " per player. We judge it by how its prediction error behaves match after match, not by whether it predicts peaks.\"";
  pc.mergeCells(r, 2, r, 4);
  style(pc.getCell(r, 2), { alignment: { wrapText: true, vertical: "top" }, font: { name: FONT, size: 11, italic: true } });
  pc.getRow(r).height = 62;
  r += 2;
  pc.getCell(r, 2).value = "Notes: C9 above is the 'Highest ever' cell. Sources: Cricsheet (cricsheet.org) for scorecards; points computed with src/lib/dream11.ts; predictions from replaying the app (scripts/entry-xlsx.ts).";
  pc.mergeCells(r, 2, r, 4);
  style(pc.getCell(r, 2), { alignment: { wrapText: true, vertical: "top" }, font: { name: FONT, size: 9, color: { argb: "FF5D6B64" } } });
  pc.getRow(r).height = 28;

  // ----- All players' points -----
  const ap = wb.addWorksheet("All players points", { views: [{ state: "frozen", ySplit: 1 }] }); // the 22 starters of each match
  ap.columns = [{ header: "Match #", width: 9 }, { header: "Date", width: 12 }, { header: "Match", width: 44 }, { header: "Player", width: 22 }, { header: "Team", width: 30 }, { header: "Role", width: 8 }, { header: "Dream11 points (plain)", width: 14 }, { header: "Runs", width: 8 }, { header: "Balls", width: 8 }, { header: "Wickets", width: 9 }, { header: "Catches", width: 9 }];
  header(ap, 1);
  const sorted = [...pts2026].sort((a, b) => a.seq - b.seq || a.team.localeCompare(b.team) || Number(b.d11) - Number(a.d11));
  for (const x of sorted) {
    const m: any = seqSet.get(x.match_id);
    const row = ap.addRow([m.matchNumber, m.date, `${m.team1} v ${m.team2}`, nameBy.get(x.player_id) ?? x.player_id, x.team, roleBy.get(x.player_id) ?? "", Number(x.d11), x.runs, x.balls, x.wickets, x.catches]);
    const band = (m.matchNumber ?? 0) % 2 === 0 ? "FFF3F7F4" : "FFFFFFFF";
    row.eachCell((c) => style(c, { fill: { type: "pattern", pattern: "solid", fgColor: { argb: band } } }));
  }
  ap.autoFilter = { from: "A1", to: `K${sorted.length + 1}` };

  // ----- Impact players: out of scope, listed for context only -----
  const ip = wb.addWorksheet("Impact subs (not pickable)", { views: [{ state: "frozen", ySplit: 1 }] });
  ip.columns = [{ header: "Match #", width: 9 }, { header: "Date", width: 12 }, { header: "Match", width: 44 }, { header: "Player", width: 22 }, { header: "Team", width: 30 }, { header: "Role", width: 8 }, { header: "Dream11 points (plain)", width: 14 }, { header: "Runs", width: 8 }, { header: "Balls", width: 8 }, { header: "Wickets", width: 9 }, { header: "Catches", width: 9 }, { header: "Why this is here", width: 70 }];
  header(ip, 1);
  const sortedImpact = [...impactRows].sort((a, b) => a.seq - b.seq || a.team.localeCompare(b.team));
  for (const x of sortedImpact) {
    const m: any = seqSet.get(x.match_id);
    const row = ip.addRow([m.matchNumber, m.date, `${m.team1} v ${m.team2}`, nameBy.get(x.player_id) ?? x.player_id, x.team, roleBy.get(x.player_id) ?? "", Number(x.d11), x.runs, x.balls, x.wickets, x.catches, "Came on as an Impact Player or concussion substitute. Out of scope: never in the pool, not pickable."]);
    row.eachCell((c) => style(c, { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F1EA" } } }));
  }
  ip.autoFilter = { from: "A1", to: `L${sortedImpact.length + 1}` };

  await db().from("md_meta").upsert({ key: "prediction_range", value: { poolMin: Math.min(...poolPreds), poolMax: Math.max(...poolPreds), teamMin: Math.min(...teamTotals), teamMax: Math.max(...teamTotals), teamMean: teamTotals.reduce((x, y) => x + y, 0) / teamTotals.length } }, { onConflict: "key" });

  const outDir = path.resolve("docs", "entry-sheets");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "IPL2026_entry_workbook.xlsx");
  await wb.xlsx.writeFile(file);
  console.log(`wrote ${file}`);
  console.log(JSON.stringify({ entryRows: rows.length, allPlayerRows: sorted.length, impactRows: sortedImpact.length, actualMax: Number(best.d11), p50: q(0.5), p90: q(0.9), p99: q(0.99), predictedPoolMin: Math.min(...poolPreds), predictedPoolMax: Math.max(...poolPreds), pickedMin: Math.min(...rows.map((x) => x.predicted)), pickedMax: Math.max(...rows.map((x) => x.predicted)), teamMin: Math.min(...teamTotals), teamMax: Math.max(...teamTotals), topCareerAvg: topAvg.avg }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
