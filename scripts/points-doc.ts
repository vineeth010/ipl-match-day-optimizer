/**
 * Actual Points Document (outside the app).
 * After a match is played, run this to get a spreadsheet-friendly CSV of every player's Dream11 points for the
 * match, worked out from the official scorecard with Dream11's T20 scoring table. Aryan reads his 11 players'
 * numbers from it and types them into the app. It is a convenience for the replayed season (the real matches are
 * already over); the app never reads this file.
 *
 * Usage: npm run points-doc                  -> one combined CSV for all IPL 2026 matches
 *        npm run points-doc -- 12            -> only match number 12
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { buildDatasetFromDir } from "../src/lib/dataset";
import { dream11Points } from "../src/lib/dream11";

async function getDir(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdo-pointsdoc-"));
  const res = await fetch("https://cricsheet.org/downloads/ipl_male_json.zip", { headers: { "user-agent": "match-day-optimizer-student-project" } });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  new AdmZip(Buffer.from(await res.arrayBuffer())).extractAllTo(dir, true);
  return dir;
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const only = process.argv[2] && /^\d+$/.test(process.argv[2]) ? Number(process.argv[2]) : null;
  const ds = buildDatasetFromDir(process.env.CRICSHEET_DIR ?? (await getDir()));
  const matches = ds.matches.filter((m) => m.isIpl2026 && (only === null || m.matchNumber === only));
  if (!matches.length) throw new Error("no matching IPL 2026 matches");

  const header = ["Match #", "Date", "Match", "Player", "Team", "Role", "Dream11 points (plain)", "Runs", "Balls", "Wickets", "Catches", "Breakdown"];
  const lines = [header.join(",")];
  for (const m of matches) {
    const rows = ds.stats.filter((s) => s.matchId === m.id).sort((a, b) => a.team.localeCompare(b.team) || (b.d11 ?? 0) - (a.d11 ?? 0));
    for (const s of rows) {
      const role = ds.players.get(s.playerId)?.role ?? "BAT";
      const { total, parts } = dream11Points(s, role);
      const breakdown = Object.entries(parts).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join("; ");
      lines.push([m.matchNumber ?? "", m.date, `${m.team1} v ${m.team2}`, s.playerName, s.team, role, total, s.runs, s.balls, s.wickets, s.catches, breakdown].map(esc).join(","));
    }
  }
  const outDir = path.resolve("docs", "actual-points");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, only === null ? "ipl2026_actual_points_all_matches.csv" : `ipl2026_match_${only}_actual_points.csv`);
  fs.writeFileSync(file, "﻿" + lines.join("\n"), "utf8"); // BOM so Excel opens it with the right encoding
  console.log(`wrote ${file} (${lines.length - 1} player rows, ${matches.length} match(es))`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
