"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GenerateButton({ matchId, regenerate = false }: { matchId: string; regenerate?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <button
        onClick={run}
        disabled={busy}
        className={
          regenerate
            ? "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-60"
            : "rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        }
      >
        {busy ? "Analysing players, venue and history…" : regenerate ? "Regenerate" : "Generate team"}
      </button>
      {busy && <p className="mt-2 text-xs text-muted">Reading dated history, building the best legal XI, then asking Gemini to explain it. About 10–15 seconds.</p>}
      {error && <p className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
