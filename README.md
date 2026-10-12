# Match Day Optimizer: IPL 2026

A Dream11 match-day agent for Aryan. Given an IPL 2026 match it builds the highest-scoring **legal** Dream11 XI, names a captain and vice-captain with reasoning specific to that match and venue, then **learns from Aryan's real points** after the match.

Built for the Mesa C4 AI Final (Hard). Case: *Fantasy Cricket Match Day Optimizer*.

![Components Map](docs/components_map.png)

## How it works

| Step | What happens | Where |
|---|---|---|
| 1. Ingest (ahead of time) | Downloads the public Cricsheet IPL archive, parses every ball, computes Dream11 points for every player in every match (1,243 matches, 27,909 player-match rows), stamps each with a match date and sequence number, loads it into Supabase. | `scripts/ingest.ts`, `src/lib/cricsheet.ts`, `src/lib/dream11.ts` |
| 2. Date gate | For match *N* the database is queried for rows with `seq < N` only. The engine then **asserts** it, and throws if any evidence is not strictly older. | `src/lib/db.ts` (`loadEvidence`), `src/lib/engine.ts` (`assertDateGate`) |
| 3. Predict | Predicted points = weighted blend of five evidence factors (recent form, career average, record at this ground, record vs this opponent, role baseline) × role and ground-type multipliers. **Code computes this; the model never produces a score.** | `src/lib/engine.ts` |
| 4. Build the team | Exhaustive branch-and-bound over the match's players for the maximum expected points (with 2x captain / 1.5x vice-captain) under every Dream11 rule; an independent validator re-checks the result before anything is shown. | `src/lib/optimizer.ts` |
| 5. Explain | Gemini Flash writes the match- and venue-specific reasoning from the engine's numbers, with strict "use only these facts" instructions, schema validation, and a deterministic fallback so a failed call never breaks a recommendation. | `src/lib/gemini.ts` |
| 6. Store predictions | Every pool player's predicted score (selected or not), its factor values and the weights version are saved. | `md_predictions`, `md_recommendations` |
| 7. Aryan plays, enters actuals | After the match he types each of his 11 players' actual Dream11 points (plain points; the app applies the multipliers). | `md_actuals`, `src/components/ActualsForm.tsx` |
| 8. Learn | Compares predicted vs actual, against a naive "career average" baseline, finds recurring errors by factor, player type and ground type, and updates the weights in **small, capped steps**, and only with enough evidence (at least 22 entries overall, at least 6 per bucket). Each change is versioned and explained in plain language. | `src/lib/learning.ts`, `md_weights`, `md_learning_log` |

### The evidence / weights split
- **Evidence** (form, venue, opponent records, earlier results) is anything dated before the match. This is how a match-8 prediction knows about match 1-7.
- **Weights** (how much each kind of evidence counts) change only from Aryan's entered points vs the agent's own predictions.

Gemini does **not** learn. What changes between matches is the small set of stored weights.

### Dream11 rules enforced
11 players · 100 credits · max 7 from one team · WK 1-4, BAT 3-6, AR 1-4, BOWL 3-6 · captain 2x · vice-captain 1.5x. Defined in `src/lib/config.ts`.

## Honest limitations
- **Credits are estimated.** Dream11 credit values are not published anywhere we could use legitimately (Dream11's terms prohibit automated access), so each player's credit is estimated from past performance and labelled as an estimate everywhere. The 100-credit rule is guaranteed only against these estimates.
- **Playing group.** The pool is the players Cricsheet lists for a match (the XI plus any impact substitute used), standing in for the post-toss announced XI.
- **Player roles** are inferred from IPL history before 2026, plus a short list of known wicketkeepers; debutants are classified by Gemini Flash when it recognises them, otherwise default to batter.
- **Prediction error is large** (about 26 Dream11 points per player in an offline replay of all 74 matches) and close to a simple career-average baseline. T20 fantasy points are very noisy. What the loop reliably does is keep over/under-prediction small; the learning page shows the agent's gap next to the baseline so improvement can be judged honestly.
- **Replay.** IPL 2026 is already over, so the season is replayed match by match from real, scraped data. The date gate is what stops the replay from leaking results.
- The Dream11 scoring table in `src/lib/dream11.ts` follows Dream11's published T20 points as closely as we know them and is easy to correct in one place.

## Run it

```bash
npm install
cp .env.example .env.local        # fill in the values
# one-off: run supabase/schema.sql in the Supabase SQL editor
npm run ingest                     # loads Cricsheet data into Supabase
npm run classify-roles             # optional: Gemini classifies debutant roles
npm run dev
```

Environment: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only), and either `GEMINI_API_KEY` (+ `GEMINI_MODEL`) or `OPENROUTER_API_KEY` (+ `OPENROUTER_MODEL`, default `google/gemini-2.5-flash`).

### Actual Points Document
After a match, `npm run points-doc -- <match number>` (or without a number for all 74) writes a CSV in `docs/actual-points/` with every player's Dream11 points and a line-by-line breakdown, worked out from the scorecard. It is an outside-the-app convenience for the replayed season; Aryan reads his players' numbers from it and types them in. A copy for all matches is already in the repo.

### Tests
`npm run test:engine -- <cricsheet-json-dir>` replays all 74 matches offline: checks the date gate rejects same-match evidence, every team is valid, and prints accuracy against the baseline.

## Stack
Next.js 16 (App Router) · Supabase (Postgres) · Gemini Flash · Vercel · Tailwind
