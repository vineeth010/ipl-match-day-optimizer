/**
 * End-to-end test of the real user workflow: follow the Excel entry workbook exactly as Aryan would.
 * For each of the first N matches: click Generate in the app (via its API), check the XI and captain match the
 * workbook's Entry sheet, then type in the workbook's "Points to enter" values and save. Cleans up after itself.
 * Usage: BASE=https://ipl-match-day-optimizer.vercel.app N=10 npx tsx scripts/workbook-e2e.ts
 */
import path from "node:path";
import dotenv from "dotenv";
import ExcelJS from "exceljs";

dotenv.config({ path: ".env.local", quiet: true });
const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const N = Number(process.env.N ?? 10);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const { db, listIplMatches } = await import("../src/lib/db");
  const wipe = async () => {
    for (const t of ["md_actuals", "md_recommendations", "md_predictions"]) await db().from(t).delete().neq("match_id", "");
    await db().from("md_learning_log").delete().gte("id", 0);
    await db().from("md_weights").delete().gt("version", 1);
  };
  await wipe();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve("docs", "entry-sheets", "IPL2026_entry_workbook.xlsx"));
  const ws = wb.getWorksheet("Entry sheet")!;
  const sheet = new Map<number, { player: string; cvc: string; predicted: number; points: number }[]>();
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const no = Number(row.getCell(1).value);
    const list = sheet.get(no) ?? [];
    list.push({ player: String(row.getCell(4).value), cvc: String(row.getCell(7).value ?? ""), predicted: Number(row.getCell(8).value), points: Number(row.getCell(9).value) });
    sheet.set(no, list);
  });
  console.log(`workbook: ${sheet.size} matches, ${[...sheet.values()].reduce((a, l) => a + l.length, 0)} rows. Target ${BASE}\n`);

  let pass = 0;
  let fail = 0;
  const ok = (name: string, cond: boolean, detail = "") => {
    cond ? pass++ : fail++;
    console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  };
  const post = async (p: string, b?: object) => {
    const res = await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
    return { status: res.status, json: await res.json().catch(() => null) };
  };

  const matches = (await listIplMatches()).slice(0, N);
  let weightsVersion = 1;
  for (const m of matches) {
    const expected = sheet.get(m.matchNumber ?? 0)!;
    const g = await post(`/api/matches/${m.id}/generate`);
    if (g.status !== 200) {
      ok(`match ${m.matchNumber}: generate`, false, `HTTP ${g.status} ${g.json?.error ?? ""}`);
      break;
    }
    const preds = ((await db().from("md_predictions").select("player_id,predicted,is_captain,is_vice").eq("match_id", m.id).eq("selected", true)).data ?? []) as any[];
    const names = new Map((((await db().from("md_players").select("id,name").in("id", preds.map((p) => p.player_id))).data ?? []) as any[]).map((r) => [r.id, r.name]));
    const app = preds.map((p) => ({ id: p.player_id, name: names.get(p.player_id) as string, cvc: p.is_captain ? "C" : p.is_vice ? "VC" : "", predicted: Number(p.predicted) }));
    const sameXI = app.length === 11 && app.every((a) => expected.some((e) => e.player === a.name && e.cvc === a.cvc && Math.abs(e.predicted - a.predicted) < 0.06));
    ok(`match ${m.matchNumber} ${m.team1} v ${m.team2}: app XI, C/VC and predictions match the workbook`, sameXI, sameXI ? "" : `app: ${app.map((a) => a.name + a.cvc).join(", ")}`);
    if (!sameXI) break;

    const points = Object.fromEntries(app.map((a) => [a.id, expected.find((e) => e.player === a.name)!.points]));
    const s = await post(`/api/matches/${m.id}/actuals`, { points });
    ok(`match ${m.matchNumber}: workbook points accepted`, s.status === 200 && s.json?.ok, `weights v${s.json?.weightsVersion}`);
    if (s.json?.weightsVersion) weightsVersion = s.json.weightsVersion;
  }

  const entered = ((await db().from("md_actuals").select("match_id")).data ?? []) as any[];
  ok(`all ${matches.length} matches were completed in order through the app`, new Set(entered.map((e) => e.match_id)).size === matches.length, `${new Set(entered.map((e) => e.match_id)).size} matches with points saved`);
  ok("the agent learned along the way (weights moved past v1)", weightsVersion > 1, `final weights v${weightsVersion}`);
  const learn = await fetch(BASE + "/learning").then((r) => r.text());
  ok("learning page reflects the run", /Current scoring weights/.test(learn) && /Learning log/.test(learn));
  const home = await fetch(BASE + "/").then((r) => r.text());
  ok("home shows the matches as played", new RegExp(`${matches.length} of 74`).test(home.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")));

  await wipe();
  console.log(`\n${pass} passed, ${fail} failed (app wiped clean)`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("TEST CRASHED:", e);
  process.exit(2);
});
