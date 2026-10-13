/**
 * Scans public/teams and public/players for the logo and photo files you dropped in and writes
 * src/lib/assets.json, so the app uses the exact filename (png, jpg, jpeg, webp or svg) without guessing.
 *
 * If the same name exists in more than one format (e.g. RR.jpeg and RR.png) one is chosen deterministically:
 * a file modified clearly later (by more than 10 seconds) wins, which is the case when you replace a logo locally;
 * otherwise, which is the case on a fresh checkout such as Vercel where every file has the same timestamp,
 * the format order png, webp, jpg, jpeg, svg decides. Best practice: delete the old file when you replace it.
 *
 * Runs automatically before `npm run dev` and `npm run build` (and therefore on every Vercel deploy).
 */
import fs from "node:fs";
import path from "node:path";

const FORMAT_ORDER = ["png", "webp", "jpg", "jpeg", "svg"];
const rank = (file) => FORMAT_ORDER.indexOf(file.split(".").pop().toLowerCase());

const scan = (dir) => {
  const best = {}; // key -> { file, mtime }
  if (!fs.existsSync(dir)) return {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)\.(png|jpe?g|webp|svg)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(); // name without extension, lower-case
    const mtime = fs.statSync(path.join(dir, f)).mtimeMs;
    const cur = best[key];
    const clearlyNewer = cur && mtime - cur.mtime > 10_000;
    const clearlyOlder = cur && cur.mtime - mtime > 10_000;
    if (!cur || clearlyNewer || (!clearlyOlder && rank(f) < rank(cur.file))) best[key] = { file: f, mtime };
  }
  return Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.file]));
};

const manifest = { teams: scan(path.resolve("public", "teams")), players: scan(path.resolve("public", "players")) };
fs.writeFileSync(path.resolve("src", "lib", "assets.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`assets: ${Object.keys(manifest.teams).length} team logo(s), ${Object.keys(manifest.players).length} player photo(s)`);
