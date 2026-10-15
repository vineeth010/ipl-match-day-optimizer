"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RoleIcon } from "./Icons";

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

  const num = (id: string) => (values[id] === undefined || values[id] === "" ? null : Number(values[id]));
  const filled = rows.filter((r) => num(r.id) !== null && Number.isFinite(num(r.id))).length;
  const mult = (r: Row) => (r.isCaptain ? 2 : r.isVice ? 1.5 : 1);
  const enteredTotal = rows.reduce((a, r) => a + (num(r.id) ?? 0) * mult(r), 0);
  const predictedSoFar = rows.reduce((a, r) => a + (num(r.id) === null ? 0 : r.predicted * mult(r)), 0);

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
        After the match, type each player&apos;s <strong className="text-ink">actual Dream11 points</strong> (the plain points, before the captain or vice-captain bonus). The system applies the 2x and 1.5x itself. Keep the Excel workbook open beside this page: the yellow cells are what you type.
      </p>

      <div className="card overflow-hidden">
        <div className="h-1.5 bg-line">
          <div className="h-full bg-gradient-to-r from-brand to-gold transition-[width] duration-500" style={{ width: `${(filled / rows.length) * 100}%` }} />
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const v = num(r.id);
            const gap = v === null || !Number.isFinite(v) ? null : v - r.predicted;
            return (
              <li key={r.id} className="grid grid-cols-[auto_1fr_auto_6.5rem] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2 sm:grid-cols-[auto_1fr_5rem_5rem_7.5rem] sm:px-4">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-bg ring-1 ring-line"><RoleIcon role={r.role} className="h-4 w-4" /></span>
                <span className="min-w-0 text-sm">
                  <span className="font-semibold">{r.name}</span>
                  {r.isCaptain && <span className="ml-1.5 rounded bg-gold px-1.5 py-0.5 text-[10px] font-bold text-navy">C</span>}
                  {r.isVice && <span className="ml-1.5 rounded bg-navy px-1.5 py-0.5 text-[10px] font-bold text-white">VC</span>}
                  <span className="block truncate text-xs text-muted">{r.role} · {r.team}</span>
                </span>
                <span className="hidden text-right text-xs text-muted sm:block">predicted<br /><span className="text-sm font-bold text-ink">{r.predicted.toFixed(1)}</span></span>
                <span className={`hidden text-right text-xs sm:block ${gap === null ? "text-muted" : gap >= 0 ? "text-good" : "text-bad"}`}>
                  gap<br /><span className="text-sm font-bold">{gap === null ? "–" : (gap >= 0 ? "+" : "") + gap.toFixed(1)}</span>
                </span>
                <input
                  inputMode="decimal"
                  type="number"
                  step="0.5"
                  aria-label={`Actual points for ${r.name}`}
                  placeholder={`~${r.predicted.toFixed(0)}`}
                  value={values[r.id] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [r.id]: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-right text-sm font-semibold outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-3 text-sm">
          <span className="text-muted">{filled} of {rows.length} entered</span>
          <span>
            Team total so far (with C/VC): <strong className="tabular-nums">{enteredTotal.toFixed(1)}</strong>{" "}
            <span className="text-xs text-muted">vs predicted {predictedSoFar.toFixed(1)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy || filled < rows.length} className="btn-primary px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Saving and learning…" : "Save points and let the system learn"}
        </button>
        {filled < rows.length && <span className="text-xs text-muted">Enter all {rows.length} to save</span>}
      </div>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {outcome && (
        <div className="anim-up rounded-2xl border border-good/30 bg-good-soft p-4 text-sm">
          <p className="font-bold text-good">Saved. Here&apos;s what the system concluded (weights v{outcome.weightsVersion}):</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{outcome.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </form>
  );
}
