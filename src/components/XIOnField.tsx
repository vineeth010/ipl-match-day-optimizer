import { teamStyle } from "@/lib/teams";

interface P {
  name: string;
  role: string;
  team: string;
  isCaptain: boolean;
  isVice: boolean;
  predicted: number;
}

/** The chosen XI placed on a stylised cricket ground: keeper behind the stumps, batters inner ring, all-rounders middle, bowlers outer. */
export default function XIOnField({ players }: { players: P[] }) {
  const cx = 180;
  const cy = 180;
  const groups: Record<string, P[]> = { WK: [], BAT: [], AR: [], BOWL: [] };
  for (const p of players) (groups[p.role] ?? groups.BAT).push(p);
  const place = (list: P[], r: number, offset: number) =>
    list.map((p, i) => {
      const a = ((offset + (i * 360) / Math.max(1, list.length)) * Math.PI) / 180;
      return { p, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
  const spots = [
    ...groups.WK.map((p, i) => ({ p, x: cx + (i - (groups.WK.length - 1) / 2) * 34, y: cy + 52 })),
    ...place(groups.BAT, 66, 200),
    ...place(groups.AR, 100, 70),
    ...place(groups.BOWL, 134, 15),
  ];
  const sur = (n: string) => n.split(" ").slice(-1)[0];
  return (
    <svg viewBox="0 0 360 360" className="w-full" role="img" aria-label="The recommended XI placed on a cricket ground">
      <defs>
        <radialGradient id="grass" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#2f9a63" />
          <stop offset="1" stopColor="#176b42" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r="172" fill="url(#grass)" stroke="#fff" strokeWidth="3" />
      {/* mowing stripes */}
      {[-120, -60, 0, 60, 120].map((d) => (
        <rect key={d} x={cx + d - 15} y={cy - 150} width="30" height="300" fill="#fff" opacity=".045" clipPath="circle(172px at 50% 50%)" />
      ))}
      <circle cx={cx} cy={cy} r="96" fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="4 5" opacity=".55" />
      {/* pitch */}
      <rect x={cx - 9} y={cy - 40} width="18" height="80" rx="2" fill="#d9b779" stroke="#b8924d" strokeWidth="1" />
      <path d={`M${cx - 14} ${cy - 30}h28M${cx - 14} ${cy + 30}h28`} stroke="#fff" strokeWidth="1.2" />
      {[-4, 0, 4].map((d) => (
        <g key={d}>
          <rect x={cx + d - 0.8} y={cy - 40} width="1.6" height="7" fill="#f7e9c4" />
          <rect x={cx + d - 0.8} y={cy + 33} width="1.6" height="7" fill="#f7e9c4" />
        </g>
      ))}
      {spots.map(({ p, x, y }) => {
        const t = teamStyle(p.team);
        const lead = p.isCaptain || p.isVice;
        return (
          <g key={p.name}>
            <circle cx={x} cy={y} r={lead ? 12.5 : 10.5} fill={t.bg} stroke={p.isCaptain ? "#f5a623" : p.isVice ? "#fff" : "rgba(255,255,255,.85)"} strokeWidth={lead ? 3 : 1.5} />
            <text x={x} y={y + 3.2} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={t.fg}>
              {p.isCaptain ? "C" : p.isVice ? "VC" : t.code.slice(0, 3)}
            </text>
            <text x={x} y={y + 23} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,.45)" strokeWidth="2.2" paintOrder="stroke">
              {sur(p.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
