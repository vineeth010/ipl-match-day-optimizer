"use client";

import { useMemo, useState } from "react";

/**
 * "Try a score": drag the slider to see where a Dream11 score lands in IPL history. The percentile is an approximation
 * interpolated between the measured landmarks (typical, top 10%, top 1%, record), not an exact ranking.
 */
export default function ScoreExplorer({ min, median, p90, p99, record, predMin, predMax }: { min: number; median: number; p90: number; p99: number; record: number; predMin: number; predMax: number }) {
  const [score, setScore] = useState(68);
  const anchors: [number, number][] = [[min, 0], [median, 50], [p90, 90], [p99, 99], [record, 100]];
  const percentile = useMemo(() => {
    if (score <= anchors[0][0]) return 0;
    for (let i = 1; i < anchors.length; i++) {
      const [x1, y1] = anchors[i];
      const [x0, y0] = anchors[i - 1];
      if (score <= x1) return y0 + ((score - x0) / (x1 - x0)) * (y1 - y0);
    }
    return 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, min, median, p90, p99, record]);

  const tier =
    score >= p99 ? { name: "Legendary", note: "Only about 1 in 100 player-matches reach this.", cls: "bg-bad-soft text-bad" } :
    score >= p90 ? { name: "Elite", note: "A top 10% day: the kind that wins contests.", cls: "bg-gold-soft text-warn" } :
    score >= median ? { name: "Solid", note: "Better than a typical player-match.", cls: "bg-brand-soft text-brand" } :
    { name: "Below typical", note: "A quiet day: most players score more.", cls: "bg-bg text-muted ring-1 ring-line" };
  const inAgentRange = score >= predMin && score <= predMax;
  const presets = [
    { label: "Typical", v: median },
    { label: "Model's best guess", v: Math.round(predMax) },
    { label: "Top 10%", v: p90 },
    { label: "Top 1%", v: p99 },
    { label: "Record", v: record },
  ];
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Try a score</h2>
          <p className="text-sm text-muted">Drag to see where any Dream11 score lands among IPL player-matches.</p>
        </div>
        <span className={`chip text-sm ${tier.cls}`}>{tier.name}</span>
      </div>
      <div className="mt-5 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
        <div className="text-center sm:text-left">
          <div className="text-6xl font-black leading-none tracking-tight tabular-nums text-gradient">{score}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-muted">Dream11 points</div>
        </div>
        <div>
          <input type="range" className="slider" min={min < 0 ? 0 : min} max={record} value={score} onChange={(e) => setScore(Number(e.target.value))} aria-label="Dream11 score" />
          <div className="mt-2 flex justify-between text-[11px] text-muted">
            <span>0</span>
            <span>typical {median}</span>
            <span>top 10% {p90}</span>
            <span>top 1% {p99}</span>
            <span>record {record}</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm">
        A score of <strong>{score}</strong> beats about <strong className="tabular-nums">{percentile.toFixed(percentile > 99 ? 1 : 0)}%</strong> of IPL player-matches. {tier.note}{" "}
        {inAgentRange ? "It is inside the range the model predicts (a prediction is an average)." : score > predMax ? "It is above anything the model would predict: the model predicts expected points, not peak days." : "It is below the system's usual range."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => setScore(p.v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${score === p.v ? "bg-navy text-white shadow" : "bg-bg text-muted ring-1 ring-line hover:text-ink"}`}>
            {p.label} · {p.v}
          </button>
        ))}
      </div>
    </div>
  );
}
