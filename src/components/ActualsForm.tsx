"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Row {
  id: string;
  name: string;
  role: string;
  team: string;
  predicted: number;
  isCaptain: boolean;
  isVice: boolean;
}

interface Outcome {
  changed: boolean;
  notes: string[];
  modelMae: number;
  baselineMae: number;
  weightsVersion: number;
}

export default function ActualsForm({ matchId, rows }: { matchId: string; rows: Row[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const filled = rows.filter((r) => values[r.id] !== undefined && values[r.id] !== "").length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const points: Record<string, number> = {};
      for (const r of rows) {
        const n = Number(values[r.id]);
        if (values[r.id] === undefined || values[r.id] === "" || !Number.isFinite(n)) throw new Error(`Enter points for ${r.name}`);
        points[r.id] = n;
      }
      const res = await fetch(`/api/matches/${matchId}/actuals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ points }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Something went wrong");
      setOutcome(j);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">
        After the match, type each player&apos;s <strong>actual Dream11 points</strong> (the plain points, before the captain or vice-captain bonus). The agent applies the 2x and 1.5x itself.
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[1fr_5rem_6.5rem] items-center gap-3 px-3 py-2 sm:grid-cols-[1fr_6rem_8rem]">
            <span className="min-w-0 text-sm">
              <span className="font-medium">{r.name}</span>{" "}
              {r.isCaptain && <Badge>C</Badge>}
              {r.isVice && <Badge>VC</Badge>}
              <span className="block text-xs text-muted">{r.role} · {r.team}</span>
            </span>
            <span className="text-right text-xs text-muted">predicted<br /><span className="text-sm font-medium text-ink">{r.predicted.toFixed(1)}</span></span>
            <input
              inputMode="decimal"
              type="number"
              step="0.5"
              placeholder="actual"
              value={values[r.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-right text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} className="rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {busy ? "Saving and learning…" : "Save points and let the agent learn"}
        </button>
        <span className="text-xs text-muted">{filled} of {rows.length} entered</span>
      </div>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {outcome && (
        <div className="rounded-xl border border-good/30 bg-good-soft p-4 text-sm">
          <p className="font-medium">Saved. Here&apos;s what the agent concluded (weights v{outcome.weightsVersion}):</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{outcome.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </form>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="ml-1 rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">{children}</span>;
}
