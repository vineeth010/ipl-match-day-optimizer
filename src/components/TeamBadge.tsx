import { teamStyle } from "@/lib/teams";

export default function TeamBadge({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const t = teamStyle(name);
  const dim = size === "lg" ? "h-16 w-16 text-lg" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs";
  return (
    <span title={name} className={`inline-grid shrink-0 place-items-center rounded-full font-extrabold tracking-tight ring-2 ring-white/70 ${dim}`} style={{ background: t.bg, color: t.fg }}>
      {t.code}
    </span>
  );
}
