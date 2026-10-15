"use client";

import Link from "next/link";
import { useState } from "react";

export interface TrendPoint {
  matchId: string;
  matchNumber: number | null;
  label: string;
  n: number;
  model: number;
  baseline: number;
  bias: number;
}

/** Prediction gap per match, model vs baseline. Lines draw in, points glow on hover or keyboard focus and show the numbers. */
export default function TrendChart({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 260;
  const pad = { l: 40, r: 18, t: 18, b: 34 };
  const max = Math.max(10, ...data.flatMap((d) => [d.model, d.baseline])) * 1.15;
  const x = (i: number) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const path = (k: "model" | "baseline") => data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const area = `${path("model")} L${x(data.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Average gap between predicted and actual points per match, model versus baseline">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="var(--line)" />
            <text x={pad.l - 8} y={y(max * t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(max * t)}</text>
          </g>
        ))}
        {data.length > 1 && <path d={area} fill="url(#trendFill)" className="anim-in" />}
        <path d={path("baseline")} pathLength={1} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="6 5" className="anim-in" />
        <path d={path("model")} pathLength={1} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="anim-draw" style={{ ["--len" as string]: 1 }} />
        {data.map((d, i) => (
          <g key={d.matchId}>
            <circle cx={x(i)} cy={y(d.baseline)} r="3" fill="var(--muted)" opacity={hover === i ? 1 : 0.5} />
            <circle cx={x(i)} cy={y(d.model)} r={hover === i ? 7 : 4.5} fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" style={{ transition: "r 0.15s" }} />
            <rect x={x(i) - 16} y={pad.t} width="32" height={H - pad.t - pad.b} fill="transparent" tabIndex={0} aria-label={`Match ${d.matchNumber}: model gap ${d.model.toFixed(1)}, baseline ${d.baseline.toFixed(1)}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} style={{ outline: "none", cursor: "pointer" }} />
            {(data.length <= 14 || i % Math.ceil(data.length / 12) === 0) && (
              <text x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.matchNumber ?? "·"}</text>
            )}
          </g>
        ))}
        <text x={W / 2} y={H - 0.5} textAnchor="middle" fontSize="10" fill="var(--muted)">match number</text>
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-xs shadow-xl anim-in" style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}>
          <p className="font-bold">Match {h.matchNumber}</p>
          <p className="truncate text-muted">{h.label}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
            <dt className="text-muted">Model gap</dt>
            <dd className="text-right font-bold text-brand">{h.model.toFixed(1)} pts</dd>
            <dt className="text-muted">Baseline gap</dt>
            <dd className="text-right font-bold">{h.baseline.toFixed(1)} pts</dd>
            <dt className="text-muted">Over/under</dt>
            <dd className="text-right font-bold">{h.bias >= 0 ? "+" : ""}{h.bias.toFixed(1)} pts</dd>
            <dt className="text-muted">Entries</dt>
            <dd className="text-right font-bold">{h.n}</dd>
          </dl>
          <Link href={`/match/${h.matchId}`} className="pointer-events-auto mt-2 block text-center font-semibold text-brand hover:underline">Open match →</Link>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-brand" /> Model</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed border-muted" /> Baseline (each player scores his career average)</span>
        <span>Lower is better. Hover or tab through the points for numbers.</span>
      </div>
    </div>
  );
}
