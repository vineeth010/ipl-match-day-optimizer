/**
 * Live end-to-end test against the deployed app (BASE=https://...). Drives the real HTTP API the way the UI does,
 * then checks the database. Cleans up after itself. Usage: BASE=https://ipl-match-day-optimizer.vercel.app npx tsx scripts/live-e2e.ts
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");

/* eslint-disable @typescript-eslint/no-explicit-any */
let pass = 0;
let fail = 0;
const t0 = Date.now();
function check(name: string, ok: boolean, detail = "") {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
async function post(path: string, body?: unknown) {
  const s = Date.now();
  const res = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json, ms: Date.now() - s };
}
async function page(path: string) {
  const res = await fetch(BASE + path);
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return { status: res.status, html, text };
}

async function main() {
  const { db, listIplMatches } = await import("../src/lib/db");
  const wipe = async () => {
    for (const t of ["md_actuals", "md_recommendations", "md_predictions"]) await db().from(t).delete().neq("match_id", "");
    await db().from("md_learning_log").delete().gte("id", 0);
    await db().from("md_weights").delete().gt("version", 1);
  };
  await wipe();
  const ms = await listIplMatches();
  const [m1, m2, m3] = ms;
  console.log(`Target: ${BASE}\n`);

  // ---------- basic pages ----------
  const home = await page("/");
  check("home page loads", home.status === 200);
  check("home lists all 74 fixtures, with only match 1 open", ms.length === 74 && (home.text.match(/Not generated/g) ?? []).length === 1 && (home.text.match(/Locked/g) ?? []).length === 73, `${(home.text.match(/Not generated/g) ?? []).length} open, ${(home.text.match(/Locked/g) ?? []).length} locked`);
  check("unknown match page → 404", (await page("/match/does-not-exist")).status === 404);
  check("learning page loads (empty state)", (await page("/learning")).status === 200);

  // ---------- the season is played in order ----------
  let lk = await post(`/api/matches/${m2.id}/generate`);
  check("generating match 2 before match 1 is played → 423 Locked", lk.status === 423, `${lk.status}`);
  lk = await post(`/api/matches/${ms[16].id}/generate`);
  check("generating match 17 directly → 423 Locked", lk.status === 423, `${lk.status}`);
  const lockedPage = await page(`/match/${ms[16].id}`);
  check("a locked match page explains the lock and offers no Generate button", /This match is locked/.test(lockedPage.text) && !/Generate team/.test(lockedPage.text));
  check("nothing was saved by the blocked attempts", ((await db().from("md_predictions").select("*", { count: "exact", head: true })).count ?? 0) === 0);

  // ---------- guard rails before anything is generated ----------
  let r = await post("/api/matches/does-not-exist/generate");
  check("generate unknown match → 404", r.status === 404, `${r.status}`);
  r = await post("/api/matches/1082591/generate"); // an old (2008) match, not IPL 2026
  check("generate non-2026 match → 400", r.status === 400, `${r.status}`);
  r = await post(`/api/matches/${m1.id}/actuals`, { points: {} });
  check("actuals before generate → 409", r.status === 409, `${r.status}`);

  // ---------- match 1 ----------
  r = await post(`/api/matches/${m1.id}/generate`);
  check("match 1 generate → 200", r.status === 200 && r.json?.ok === true, `${r.ms} ms, fallback=${r.json?.usedFallback}`);
  check("match 1 Gemini explanation used (not fallback)", r.json?.usedFallback === false);
  check("generate finishes well inside Vercel's 60s limit", r.ms < 45000, `${(r.ms / 1000).toFixed(1)}s`);

  const preds1 = (await db().from("md_predictions").select("*").eq("match_id", m1.id)).data ?? [];
  const sel1 = preds1.filter((p: any) => p.selected);
  check("match 1: pool is exactly the 22 starters (11 a side)", preds1.length === 22, `${preds1.length} rows`);
  const impactMeta = ((await db().from("md_meta").select("value").eq("key", "impact_players").maybeSingle()).data as any)?.value ?? {};
  const impactIds = new Set(((impactMeta[m1.id] ?? []) as { playerId: string }[]).map((x) => x.playerId));
  check("match 1: no Impact Player is in the pool or the XI", impactIds.size > 0 && !preds1.some((p: any) => impactIds.has(p.player_id)), `${impactIds.size} impact players recorded, none in the pool`);
  check("match 1: exactly 11 selected, 1 captain, 1 vice", sel1.length === 11 && sel1.filter((p: any) => p.is_captain).length === 1 && sel1.filter((p: any) => p.is_vice).length === 1);
  const credits = sel1.reduce((a: number, p: any) => a + Number(p.credit), 0);
  const perTeam: Record<string, number> = {};
  const perRole: Record<string, number> = {};
  for (const p of sel1) {
    perTeam[p.team] = (perTeam[p.team] ?? 0) + 1;
    perRole[p.role] = (perRole[p.role] ?? 0) + 1;
  }
  check("match 1: credits ≤ 100", credits <= 100, `${credits}`);
  check("match 1: ≤ 7 from one team", Math.max(...Object.values(perTeam)) <= 7, JSON.stringify(perTeam));
  check("match 1: role limits respected", (perRole.WK ?? 0) >= 1 && (perRole.WK ?? 0) <= 4 && (perRole.BAT ?? 0) >= 3 && (perRole.BAT ?? 0) <= 6 && (perRole.AR ?? 0) >= 1 && (perRole.AR ?? 0) <= 4 && (perRole.BOWL ?? 0) >= 3 && (perRole.BOWL ?? 0) <= 6, JSON.stringify(perRole));
  const rec1: any = (await db().from("md_recommendations").select("*").eq("match_id", m1.id).single()).data;
  check("match 1: date-gate cutoff recorded", rec1.data_cutoff_seq === m1.seq, `cutoff seq ${rec1.data_cutoff_seq}`);
  const stats1 = (await db().from("md_player_stats").select("player_id,d11").eq("match_id", m1.id).in("player_id", sel1.map((p: any) => p.player_id))).data ?? [];
  const pts1 = Object.fromEntries(stats1.map((s: any) => [s.player_id, Number(s.d11)]));
  const page1 = await page(`/match/${m1.id}`);
  check("match 1 page shows XI, bench and disclaimer", /Recommended XI/.test(page1.text) && /Bench: left out/.test(page1.text) && /Early-season model/.test(page1.text));
  check("match 1 page hides the match result before points are entered", !/Result:/.test(page1.text));
  check("match page states the 11-a-side / Impact Player assumption", /starting XI \(11 a side\)/.test(page1.text) && /Impact Player rule is out of scope/.test(page1.text));
  check("impact-player note is hidden until points are entered", !/Impact players who came on/.test(page1.text));

  // ---------- bad input to actuals ----------
  const partial = { ...pts1 };
  delete partial[sel1[0].player_id];
  r = await post(`/api/matches/${m1.id}/actuals`, { points: partial });
  check("actuals with a missing player → 400", r.status === 400, `${r.status}`);
  r = await post(`/api/matches/${m1.id}/actuals`, { points: { ...pts1, [sel1[0].player_id]: 99999 } });
  check("actuals with absurd points → 400", r.status === 400, `${r.status}`);
  r = await post(`/api/matches/${m1.id}/actuals`, { points: { ...pts1, [sel1[0].player_id]: "abc" } });
  check("actuals with non-numeric value → 400", r.status === 400, `${r.status}`);
  r = await post(`/api/matches/${m1.id}/actuals`, "{not json");
  check("actuals with malformed JSON → 4xx, not a crash", r.status >= 400 && r.status < 500, `${r.status}`);
  check("rejected inputs saved nothing", ((await db().from("md_actuals").select("*").eq("match_id", m1.id)).data ?? []).length === 0);

  // ---------- enter match 1 (this is what Aryan does) ----------
  r = await post(`/api/matches/${m1.id}/actuals`, { points: pts1 });
  check("match 1 actuals saved → 200", r.status === 200 && r.json?.ok, `${r.ms} ms`);
  check("after 1 match: agent refuses to change weights (needs ≥ 22 entries)", r.json?.changed === false && /at least 22/.test((r.json?.notes ?? []).join(" ")), `v${r.json?.weightsVersion}`);
  r = await post(`/api/matches/${m1.id}/generate`);
  check("regenerate after points entered → locked (409)", r.status === 409, `${r.status}`);
  const page1b = await page(`/match/${m1.id}`);
  check("after points are entered the page shows the impact-player note", /Impact players who came on \(not pickable\)/.test(page1b.text));
  check("match 1 page now reveals the result and the gap column", /Result:/.test(page1b.text) && page1b.text.includes("Team total (with C / VC bonus)"));

  const lock3 = await post(`/api/matches/${m3.id}/generate`);
  check("match 3 stays locked while match 2 is unplayed → 423", lock3.status === 423, `${lock3.status}`);
  const homeMid = await page("/");
  check("home shows match 2 open and match 3 locked after match 1", (homeMid.text.match(/Locked/g) ?? []).length === 72, `${(homeMid.text.match(/Locked/g) ?? []).length} locked`);

  // ---------- match 2 ----------
  r = await post(`/api/matches/${m2.id}/generate`);
  check("match 2 generate → 200", r.status === 200 && r.json?.ok, `${r.ms} ms`);
  const page2 = await page(`/match/${m2.id}`);
  check("match 2 page carries forward what match 1 concluded", /What the agent carries forward/.test(page2.text) && /Only 11 entered/.test(page2.text));
  const sel2 = ((await db().from("md_predictions").select("*").eq("match_id", m2.id).eq("selected", true)).data ?? []) as any[];
  const stats2 = (await db().from("md_player_stats").select("player_id,d11").eq("match_id", m2.id).in("player_id", sel2.map((p) => p.player_id))).data ?? [];
  const pts2 = Object.fromEntries(stats2.map((s: any) => [s.player_id, Number(s.d11)]));
  r = await post(`/api/matches/${m2.id}/actuals`, { points: pts2 });
  check("match 2 actuals saved → learning runs", r.status === 200 && r.json?.ok, `${r.ms} ms`);
  check("after 2 matches (22 entries): weights version bumps and reasons are given", r.json?.changed === true && r.json?.weightsVersion === 2 && (r.json?.notes ?? []).length > 0, `v${r.json?.weightsVersion}; ${(r.json?.notes ?? []).length} notes`);
  const w: any = (await db().from("md_weights").select("*").order("version", { ascending: false }).limit(1)).data?.[0];
  const fsum = Object.values(w.factors as Record<string, number>).reduce((a, b) => a + b, 0);
  check("new factor weights sum to 1", Math.abs(fsum - 1) < 0.011, `${fsum.toFixed(3)}`);
  check("weight moves are capped (≤ 5 pts per factor)", Object.keys(w.factors).every((k) => Math.abs(w.factors[k] - ({ form: 0.35, career: 0.25, venue: 0.2, opp: 0.1, role: 0.1 } as any)[k]) <= 0.061));
  check("multipliers stay within 0.8–1.2", [...Object.values(w.role_mult as Record<string, number>), ...Object.values(w.venue_mult as Record<string, number>)].every((v) => v >= 0.8 && v <= 1.2));

  // ---------- idempotency + concurrency ----------
  const again = await post(`/api/matches/${m2.id}/actuals`, { points: pts2 });
  check("re-submitting the same points creates no duplicates", ((await db().from("md_actuals").select("*").eq("match_id", m2.id)).data ?? []).length === 11);
  check("re-submitting identical points changes nothing (no weight drift)", again.json?.changed === false && again.json?.weightsVersion === 2, `v${again.json?.weightsVersion}`);
  const vAfterSame = ((await db().from("md_weights").select("version").order("version", { ascending: false }).limit(1)).data ?? [])[0]?.version;
  check("no extra weights version was created by the repeat", vAfterSame === 2, `latest v${vAfterSame}`);
  const fixed = { ...pts2, [sel2[0].player_id]: pts2[sel2[0].player_id] + 10 };
  const corr = await post(`/api/matches/${m2.id}/actuals`, { points: fixed });
  check("correcting the latest match re-learns once (one new version)", corr.json?.ok && corr.json?.weightsVersion === 3 && /corrected/.test((corr.json?.notes ?? []).join(" ")), `v${corr.json?.weightsVersion}`);
  const corr2 = await post(`/api/matches/${m2.id}/actuals`, { points: fixed });
  check("repeating the correction changes nothing", corr2.json?.changed === false && corr2.json?.weightsVersion === 3, `v${corr2.json?.weightsVersion}`);
  await post(`/api/matches/${m2.id}/actuals`, { points: pts2 }); // put the original points back for the later page checks
  const [a, b] = await Promise.all([post(`/api/matches/${m3.id}/generate`), post(`/api/matches/${m3.id}/generate`)]);
  const m3rows = ((await db().from("md_predictions").select("*").eq("match_id", m3.id).eq("selected", true)).data ?? []).length;
  check("double-click generate (2 simultaneous requests) leaves a consistent result", (a.status === 200 || b.status === 200) && m3rows === 11, `statuses ${a.status}/${b.status}, ${m3rows} selected rows`);

  // ---------- pages after learning ----------
  const learn = await page("/learning");
  check("learning page shows trend, weights and log", learn.status === 200 && /Learning log/.test(learn.text) && /version [0-9]+/.test(learn.text) && /Current scoring weights/.test(learn.text), `status ${learn.status}, log:${/Learning log/.test(learn.text)}, version:${/version [0-9]+/.test(learn.text)}, weights:${/Current scoring weights/.test(learn.text)}, len ${learn.text.length} | ${learn.text.slice(Math.max(0, learn.text.indexOf("Current scoring")), Math.max(0, learn.text.indexOf("Current scoring")) + 90)}`);
  const home2 = await page("/");
  check("home shows 2 of 74 played", /2 of 74/.test(home2.text));

  // ---------- security ----------
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = await fetch(`${url}/rest/v1/md_actuals?select=*&limit=1`, { headers: { apikey: "sb_publishable_pHH787lsQl_J0w0tsQsNgw_6ZakNXQ5" } });
  const anonBody = await anon.text();
  check("database is closed to the public key (RLS on, no policies)", anonBody === "[]" || anon.status >= 400, `HTTP ${anon.status} body ${anonBody.slice(0, 40)}`);
  const scripts = [...home.html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  let leaked = false;
  for (const s of scripts.slice(0, 20)) {
    const js = await (await fetch(s.startsWith("http") ? s : BASE + s)).text();
    if (/sb_secret_|sk-or-v1-|service_role/.test(js)) leaked = true;
  }
  check("no secret keys in any client JavaScript", !leaked, `${scripts.length} bundles scanned`);

  await wipe();
  const left = (await db().from("md_actuals").select("*", { count: "exact", head: true })).count;
  check("cleanup left the app blank", left === 0);
  console.log(`\n${pass} passed, ${fail} failed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("TEST CRASHED:", e);
  process.exit(2);
});
