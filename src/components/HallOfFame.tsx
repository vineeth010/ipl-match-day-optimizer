import type { Performance, PointsScale } from "@/lib/scale";
import { BallIcon, BatIcon, GlovesIcon, StumpsIcon } from "./Icons";
import PlayerPhoto from "./PlayerPhoto";
import TeamBadge from "./TeamBadge";

const SLUG: Record<string, string> = { "Abhishek Sharma": "abhishek-sharma", "MA Starc": "starc", "SP Narine": "narine", "RR Pant": "pant" };
const FULL: Record<string, string> = { "MA Starc": "Mitchell Starc", "SP Narine": "Sunil Narine", "RR Pant": "Rishabh Pant" };

export default function HallOfFame({ scale }: { scale: PointsScale }) {
  const cards: { title: string; perf: Performance; icon: React.ReactNode; accent: string }[] = [
    { title: "Best batting day", perf: scale.stars.batter, icon: <BatIcon className="h-5 w-5" />, accent: "from-gold/90 to-amber-600" },
    { title: "Best bowling day", perf: scale.stars.bowler, icon: <BallIcon className="h-5 w-5" />, accent: "from-sky-500 to-brand" },
    { title: "Best all-round day", perf: scale.stars.allRounder, icon: <StumpsIcon className="h-5 w-5" />, accent: "from-emerald-500 to-pitch" },
    { title: "Best keeper day", perf: scale.stars.keeper, icon: <GlovesIcon className="h-5 w-5" />, accent: "from-fuchsia-500 to-purple-700" },
  ];
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Stars of IPL {scale.stars.season}</h2>
          <p className="text-sm text-muted">The best single-match Dream11 scores of the {scale.stars.season} season, by kind of player. Real match days score far higher than a prediction, which is why predictions are averages, not peaks. The all-time record is {scale.max.points}.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, perf, icon, accent }) => {
          const slug = SLUG[perf.player];
          const name = FULL[perf.player] ?? perf.player;
          return (
            <article key={title} className="card lift overflow-hidden">
              <div className={`relative h-44 bg-gradient-to-br ${accent}`}>
                <PlayerPhoto slug={slug} alt={name} fallback={<div className="flex flex-col items-center gap-1 opacity-90"><span className="scale-[2.2]">{icon}</span><span className="mt-5 text-xs font-medium">{name}</span></div>} />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur">
                  {icon}
                  {title}
                </span>
                <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between text-white">
                  <div className="text-3xl font-extrabold leading-none drop-shadow">{perf.points}</div>
                  <div className="text-right text-[11px] leading-tight opacity-90">Dream11<br />points</div>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <TeamBadge name={perf.team} size="sm" />
                  <h3 className="font-semibold leading-tight">{name}</h3>
                </div>
                <p className="mt-1.5 text-sm">{perf.summary}</p>
                <p className="text-xs text-muted">vs {perf.opponent}, {perf.date.slice(0, 4)}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
