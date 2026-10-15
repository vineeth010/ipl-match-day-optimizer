import { z } from "zod";
import type { VenueProfile } from "./engine";
import type { BenchEntry, TeamResult } from "./optimizer";
import type { MatchRow, PlayerPrediction } from "./types";

/**
 * Gemini Flash's only job: turn the engine's numbers into match- and venue-specific reasoning.
 * It never produces a score, never picks the team, and is told to use only the facts it is given.
 * Calls go to Google directly when GEMINI_API_KEY is set, otherwise through OpenRouter (model: a Gemini Flash).
 */
export const ReasoningSchema = z.object({
  summary: z.string(),
  venueNote: z.string(),
  captain: z.string(),
  viceCaptain: z.string(),
  picks: z.array(z.object({ name: z.string(), reason: z.string() })),
  benchNotes: z.array(z.object({ name: z.string(), reason: z.string() })).default([]),
  risks: z.string().default(""),
});
export type Reasoning = z.infer<typeof ReasoningSchema>;

export interface ExplainInput {
  match: MatchRow;
  venue: VenueProfile;
  team: TeamResult;
  bench: BenchEntry[];
  weightsVersion: number;
}

function facts(p: PlayerPrediction) {
  return {
    name: p.name,
    team: p.team,
    role: p.role,
    expectedPoints: p.predicted,
    credits: p.credit,
    last5Dream11Points: p.last5,
    careerAvgPoints: p.factors.career,
    formScore: p.factors.form,
    atThisVenue: { matches: p.venueMatches, blendedAvg: p.factors.venue },
    vsThisOpponent: { matches: p.oppMatches, blendedAvg: p.factors.opp },
    matchesOfHistory: p.matchesOfHistory,
  };
}

export function buildPrompt(i: ExplainInput): string {
  const { match, venue, team } = i;
  const data = {
    match: { teams: [match.team1, match.team2], venue: match.venueFull, date: match.date, tossWinner: match.tossWinner, tossDecision: match.tossDecision },
    venueHistory: { matchesBeforeToday: venue.matches, avgFirstInningsScore: venue.avgFirstInnings, chasingTeamWinPct: venue.chaseWinPct, classification: venue.type },
    captain: facts(team.captain),
    viceCaptain: facts(team.viceCaptain),
    selectedXI: team.players.map(facts),
    benchTop: i.bench.slice(0, 6).map((b) => ({ ...facts(b.player), whyLeftOut: b.reason })),
  };
  return `You are the reasoning writer for a fantasy cricket (Dream11) match-day optimizer. A deterministic engine has ALREADY chosen the team and captain from historical data. Your job is only to explain those choices to Aryan in plain, confident language he can repeat to his fantasy league group.

STRICT RULES
- Use ONLY the facts in the JSON below. Never invent statistics, injuries, pitch reports, form, or news. If a number is not in the JSON, do not state it.
- Be specific to THIS match and THIS venue: mention the venue's history (avg first-innings score, chasing win %), the toss, the opponent record, and recent Dream11 points where they exist.
- If a player has little history here (matches: 0 or very few), say honestly that the evidence is thin instead of overselling.
- Do not use vague filler like "in good form" unless backed by a number from the data.
- Keep each reason to 1-2 sentences. Do not change who is captain or vice-captain.

Return ONLY a JSON object with exactly these keys:
{"summary": string (2-3 sentences on the overall approach for this match),
 "venueNote": string (what the venue history means for this match),
 "captain": string (why this captain, with numbers),
 "viceCaptain": string (why this vice-captain, with numbers),
 "picks": [{"name": string, "reason": string}] (one entry for every player in selectedXI, same names),
 "benchNotes": [{"name": string, "reason": string}] (for benchTop players, based on whyLeftOut),
 "risks": string (1-2 sentences: the main uncertainty in this team)}

DATA
${JSON.stringify(data)}`;
}

async function callModel(prompt: string): Promise<{ text: string; model: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40_000);
  try {
    if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: "application/json" } }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const j = await res.json();
      return { text: j.candidates?.[0]?.content?.parts?.[0]?.text ?? "", model };
    }
    if (process.env.OPENROUTER_API_KEY) {
      const model = process.env.OPENROUTER_MODEL || "google/gemini-3.6-flash";
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        body: JSON.stringify({ model, temperature: 0.3, reasoning: { effort: "low" }, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
      const j = await res.json();
      return { text: j.choices?.[0]?.message?.content ?? "", model };
    }
    throw new Error("No Gemini credentials configured");
  } finally {
    clearTimeout(timer);
  }
}

/** Generic JSON call, used for the debutant role-classification step. */
export async function askJson(prompt: string): Promise<{ data: unknown; model: string }> {
  const { text, model } = await callModel(prompt);
  return { data: extractJson(text), model };
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(t);
}

/** Templated reasoning built only from the engine's numbers. Used if Gemini is unavailable or returns something invalid. */
export function fallbackReasoning(i: ExplainInput): Reasoning {
  const { match, venue, team } = i;
  const v = venue.avgFirstInnings != null ? `${match.venueFull} has averaged ${venue.avgFirstInnings} in the first innings over ${venue.matches} earlier IPL matches` : `${match.venueFull} has too little earlier IPL history to say much`;
  const line = (p: PlayerPrediction) =>
    `${p.name} is expected to score ${p.predicted} points (career average ${p.factors.career}; last ${p.last5.length || 0} matches: ${p.last5.join(", ") || "no earlier data"}; ${p.venueMatches} earlier match(es) at this ground, ${p.oppMatches} against this opponent).`;
  return {
    summary: `The system picked the 11 players with the highest expected Dream11 points that also satisfy every team rule (100 credits, at most 7 from one side, role limits).`,
    venueNote: `${v}.`,
    captain: line(team.captain),
    viceCaptain: line(team.viceCaptain),
    picks: team.players.map((p) => ({ name: p.name, reason: line(p) })),
    benchNotes: i.bench.slice(0, 6).map((b) => ({ name: b.player.name, reason: b.reason })),
    risks: "These are statistical expectations from past IPL data; the XI, pitch and conditions on the day can change the outcome.",
  };
}

export async function explainTeam(i: ExplainInput): Promise<{ reasoning: Reasoning; usedFallback: boolean; model: string; error?: string }> {
  try {
    const { text, model } = await callModel(buildPrompt(i));
    const parsed = ReasoningSchema.parse(extractJson(text));
    // every picked player must be covered, otherwise fill the gaps from the deterministic text
    const fb = fallbackReasoning(i);
    const have = new Set(parsed.picks.map((p) => p.name));
    for (const p of fb.picks) if (!have.has(p.name)) parsed.picks.push(p);
    return { reasoning: parsed, usedFallback: false, model };
  } catch (e) {
    return { reasoning: fallbackReasoning(i), usedFallback: true, model: "deterministic-fallback", error: e instanceof Error ? e.message : String(e) };
  }
}
