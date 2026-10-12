import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const { generateForMatch, matchView } = await import("../src/lib/service");
  const { db } = await import("../src/lib/db");
  const id = "1527674"; // IPL 2026 match 1
  const t0 = Date.now();
  const r = await generateForMatch(id);
  console.log("generated in", Date.now() - t0, "ms | usedFallback:", r.usedFallback, r.aiError ?? "");
  const v = await matchView(id);
  console.log("XI:", v!.xi.map((p) => `${p.name}(${p.role},${p.credit}cr,${p.predicted})${p.is_captain ? " C" : ""}${p.is_vice ? " VC" : ""}`).join(" | "));
  console.log("checks:", (v!.rec!.checks as any[]).map((c) => (c.ok ? "ok " : "FAIL ") + c.rule).join("; "));
  const re = v!.rec!.reasoning as any;
  console.log("model:", v!.rec!.model, "\nsummary:", re.summary, "\nvenue:", re.venueNote, "\ncaptain:", re.captain, "\nvc:", re.viceCaptain, "\nrisks:", re.risks);
  // clean up the test run so the app starts blank
  await db().from("md_recommendations").delete().eq("match_id", id);
  await db().from("md_predictions").delete().eq("match_id", id);
  console.log("cleaned up");
}
main().catch((e) => { console.error(e); process.exit(1); });
