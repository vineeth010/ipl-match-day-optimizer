/**
 * Debutant role classification (an AI task, so it uses Gemini Flash).
 * Players with no IPL history before 2026 have no role we can infer from data. We ask Gemini to classify them from
 * general cricket knowledge: WK / BAT / AR / BOWL. A role is public squad information, not a match result, so this
 * does not leak anything from the replayed season. Anything Gemini is unsure about stays as the default.
 * Usage: npm run classify-roles
 */
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: ".env.local", quiet: true });

const Answer = z.array(z.object({ name: z.string(), role: z.enum(["WK", "BAT", "AR", "BOWL", "UNKNOWN"]) }));

async function main() {
  const { db } = await import("../src/lib/db");
  const { askJson } = await import("../src/lib/gemini");
  const { data: players, error } = await db().from("md_players").select("id, name").eq("role_source", "default");
  if (error) throw new Error(error.message);
  if (!players?.length) return console.log("no debutants to classify");
  console.log(`classifying ${players.length} players with no earlier IPL history`);

  const names = players.map((p) => p.name);
  const prompt = `Classify each cricketer into ONE Dream11 role: "WK" (wicketkeeper), "BAT" (batter), "AR" (all-rounder), or "BOWL" (bowler). Use your general cricket knowledge. If you do not recognise the player, answer "UNKNOWN" - do not guess. Names are in Cricsheet format (initials + surname), and these players debuted in or around the 2026 IPL.
Return ONLY a JSON array: [{"name": string, "role": "WK"|"BAT"|"AR"|"BOWL"|"UNKNOWN"}] with one entry per name, same spelling.
Names: ${JSON.stringify(names)}`;

  const { data, model } = await askJson(prompt);
  const parsed = Answer.parse(Array.isArray(data) ? data : (data as { players?: unknown }).players);
  const byName = new Map(parsed.map((a) => [a.name, a.role]));
  let updated = 0;
  for (const p of players) {
    const r = byName.get(p.name);
    if (!r || r === "UNKNOWN") continue;
    const { error: e } = await db().from("md_players").update({ role: r, role_source: "ai" }).eq("id", p.id);
    if (e) throw new Error(e.message);
    updated++;
    console.log(`  ${p.name.padEnd(24)} -> ${r}`);
  }
  console.log(`updated ${updated} of ${players.length} using ${model}; the rest keep the default BAT role`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
