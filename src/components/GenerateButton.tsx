"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PHASES = [
  "Reading each player's dated history…",
  "Blending form, ground and opponent records…",
  "Building the best legal XI…",
  "Checking 100 credits, 7 per team and roles…",
  "Asking Gemini to explain the picks…",
];

export default function GenerateButton({ matchId, regenerate = false }: { matchId: string; regenerate?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // advance the progress text while the server works (a visual guide, not a measured percentage)
  useEffect(() => {
    if (!busy) return;
    setPhase(0);
    const id = setInterval(() => setPhase((p) => Math.min(PHASES.length - 1, p + 1)), 2600);
    return () => clearInterval(id);
  }, [busy]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/generate`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Something went wrong");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (regenerate) {
    return (
      <div>
        <button onClick={run} disabled={busy} className="rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-gold hover:text-navy disabled:opacity-60">
          {busy ? "Regenerating…" : "Regenerate"}
        </button>
        {error && <p className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <button onClick={run} disabled={busy} className="btn-gold relative w-full overflow-hidden px-6 py-3.5 text-base disabled:opacity-90">
        {busy ? "Working…" : "Generate team"}
        {!busy && <span className="ml-2">→</span>}
        {busy && <span className="skeleton absolute inset-0 opacity-30" />}
      </button>
      {busy && (
        <div className="anim-in mt-4" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-gold transition-[width] duration-[2400ms] ease-out" style={{ width: `${((phase + 1) / PHASES.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-center text-sm font-medium">{PHASES[phase]}</p>
          <p className="mt-0.5 text-center text-xs text-muted">Usually 10 to 20 seconds. Predictions come from code; Gemini only writes the explanation.</p>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
