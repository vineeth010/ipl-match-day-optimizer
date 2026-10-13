import type { PointsScale, PredictionRange } from "@/lib/scale";

/**
 * The points scale: where a score sits between "typical" and the IPL record, and where the agent's predictions live.
 * Pure markup (no client JS).
 */
export default function ScaleStrip({ scale, range, compact = false, dark = false }: { scale: PointsScale; range: PredictionRange; compact?: boolean; dark?: boolean }) {
  const top = scale.max.points;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / top) * 100))}%`;
  const w = (a: number, b: number) => `${((b - a) / top) * 100}%`;
  const text = dark ? "text-white" : "text-ink";
  const sub = dark ? "text-white/70" : "text-muted";
  const marks = [
    { v: scale.median, big: String(scale.median), small: "typical", align: "-translate-x-1/2" },
    { v: scale.p90, big: String(scale.p90), small: "top 10%", align: "-translate-x-1/2" },
    { v: scale.p99, big: String(scale.p99), small: "top 1%", align: "-translate-x-1/2" },
    { v: top, big: String(top), small: "record", align: "-translate-x-full" },
  ];
  const recordName = scale.max.player === "CH Gayle" ? "Chris Gayle" : scale.max.player;
  return (
    <div>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={`text-sm font-semibold ${text}`}>How big is a Dream11 score? The IPL points scale</h2>
          <span className={`text-xs ${sub}`}>
            {scale.rows.toLocaleString()} player-matches, IPL {scale.firstSeason}–{scale.lastSeason}
          </span>
        </div>
      )}
      <div className="relative pb-11">
        {/* the scale bar */}
        <div className="flex h-3 overflow-hidden rounded-full ring-1 ring-black/10">
          <div style={{ width: w(0, scale.median) }} className="anim-grow bg-slate-300" />
          <div style={{ width: w(scale.median, scale.p90), ["--d" as string]: "120ms" }} className="anim-grow bg-sky-400" />
          <div style={{ width: w(scale.p90, scale.p99), ["--d" as string]: "240ms" }} className="anim-grow bg-gold" />
          <div style={{ width: w(scale.p99, top), ["--d" as string]: "360ms" }} className="anim-grow bg-bad" />
        </div>
        {/* where the agent's predictions live */}
        <div className="relative mt-1.5 h-3">
          <div className="anim-grow absolute h-2.5 rounded-full bg-brand ring-2 ring-white/60" style={{ ["--d" as string]: "600ms", left: pct(Math.max(0, range.poolMin)), width: w(Math.max(0, range.poolMin), range.poolMax) }} title={`The agent's predictions run ${Math.round(range.poolMin)} to ${Math.round(range.poolMax)} per player`} />
          <span className={`absolute top-[-1px] whitespace-nowrap text-[11px] font-semibold ${dark ? "text-sky-200" : "text-brand"}`} style={{ left: `calc(${pct(range.poolMax)} + 8px)` }}>
            ← the agent predicts {Math.round(range.poolMin)}–{Math.round(range.poolMax)} per player
          </span>
        </div>
        {marks.map((m) => (
          <div key={m.small} className={`anim-in absolute top-[2.4rem] ${m.align} text-center leading-tight`} style={{ left: pct(m.v), ["--d" as string]: "700ms" }}>
            <div className={`text-sm font-bold ${text}`}>{m.big}</div>
            <div className={`text-[10px] uppercase tracking-wide ${sub}`}>{m.small}</div>
          </div>
        ))}
      </div>
      <p className={`mt-1 text-xs leading-relaxed ${sub}`}>
        <strong className={text}>No hard cap in the rules.</strong> The highest score in IPL history is <strong className={text}>{top}</strong> ({recordName}, {scale.max.summary}, {scale.max.date.slice(0, 4)}), and only {(scale.share.above150 * 100).toFixed(1)}% of
        player-matches ever pass 150. The agent predicts <em>expected</em> points, an average, so its predictions sit in the blue band, far below peak days. A whole XI is expected to score about {Math.round(range.teamMin)}–{Math.round(range.teamMax)} with captain bonuses.
      </p>
    </div>
  );
}
