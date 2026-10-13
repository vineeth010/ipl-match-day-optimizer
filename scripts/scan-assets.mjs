/**
 * Scans public/teams and public/players for the logo and photo files you dropped in and writes
 * src/lib/assets.json, so the app uses the exact filename (png, jpg, jpeg, webp or svg) without guessing.
 * If the same name exists in two formats (e.g. RR.jpeg and RR.png), the most recently modified file wins.
 * Runs automatically before `npm run dev` and `npm run build` (and therefore on every Vercel deploy).
 */
import fs from "node:fs";
import path from "node:path";

const scan = (dir) => {
  const out = {};
  const newest = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)\.(png|jpe?g|webp|svg)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(); // name without extension, lower-case
    const mtime = fs.statSync(path.join(dir, f)).mtimeMs;
    if (!(key in newest) || mtime > newest[key]) {
      newest[key] = mtime;
      out[key] = f; // the actual file name
    }
  }
  return out;
};

const manifest = { teams: scan(path.resolve("public", "teams")), players: scan(path.resolve("public", "players")) };
fs.writeFileSync(path.resolve("src", "lib", "assets.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`assets: ${Object.keys(manifest.teams).length} team logo(s), ${Object.keys(manifest.players).length} player photo(s)`);
