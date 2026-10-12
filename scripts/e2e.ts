import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
async function wipe() {
  const { db } = await import("../src/lib/db");
  for (const t of ["md_actuals", "md_learning_log", "md_recommendations", "md_predictions"]) {
    const col = t === "md_learning_log" ? "id" : "match_id";
    const q = t === "md_learning_log" ? db().from(t).delete().gte("id", 0) : db().from(t).delete().neq(col, "");
    const { error } = await q; if (error) throw new Error(t + ": " + error.message);
  }
  const { error } = await db().from("md_weights").delete().gt("version", 1); if (error) throw new Error(error.message);
}
async function main() {
  const { generateForMatch, saveActualsAndLearn, matchView } = await import("../src/lib/service");
  const { db, listIplMatches } = await import("../src/lib/db");
  await wipe();
  const matches = (await listIplMatches()).slice(0, 3);
  for (const m of matches) {
    const g = await generateForMatch(m.id);
    const v = await matchView(m.id);
    console.log(`\n#${m.matchNumber} ${m.team1} v ${m.team2} | gemini ok: ${!g.usedFallback} | carried-forward notes: ${v!.previousLearning ? (v!.previousLearning.notes as string[]).length : 0}`);
    if (v!.previousLearning) console.log("   carry-forward:", (v!.previousLearning.notes as string[])[0].slice(0, 140));
    const ids = v!.xi.map((p) => p.player_id);
    const { data } = await db().from("md_player_stats").select("player_id,d11").eq("match_id", m.id).in("player_id", ids);
    const points = Object.fromEntries((data ?? []).map((r: any) => [r.player_id, Number(r.d11)]));
    const r = await saveActualsAndLearn(m.id, points);
    console.log(`   learned: changed=${r.changed} weights v${r.after.version} | model gap ${r.modelMae} vs baseline ${r.baselineMae}`);
    for (const n of r.notes) console.log("    -", n.slice(0, 170));
  }
  await wipe();
  console.log("\ncleaned up test data");
}
main().catch((e) => { console.error(e); process.exit(1); });
