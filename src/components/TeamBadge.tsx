"use client";

import { useState } from "react";
import assets from "@/lib/assets.json";
import { teamStyle } from "@/lib/teams";

/* eslint-disable @next/next/no-img-element */
const DIM = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-14 w-14 text-sm",
  lg: "h-24 w-24 text-2xl",
  xl: "h-28 w-28 text-3xl",
} as const;

const LOGOS = assets.teams as Record<string, string>;

/**
 * The team's official logo if one was dropped into public/teams/ (png, jpg, jpeg, webp or svg; the build scans the
 * folder), otherwise a large colour crest. Logos sit contained on a white disc so any artwork stays legible.
 */
export default function TeamBadge({ name, size = "md" }: { name: string; size?: keyof typeof DIM }) {
  const t = teamStyle(name);
  const file = LOGOS[t.code.toLowerCase()];
  const [broken, setBroken] = useState(false);
  if (file && !broken) {
    return (
      <span title={name} className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-md ring-2 ring-white/80 ${DIM[size].split(" ").slice(0, 2).join(" ")}`}>
        <img src={`/teams/${file}`} alt={`${name} logo`} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain p-[7%]" />
      </span>
    );
  }
  return (
    <span
      title={name}
      className={`inline-grid shrink-0 place-items-center rounded-full font-extrabold tracking-tight shadow-md ring-[3px] ring-white/80 ${DIM[size]}`}
      style={{ background: `radial-gradient(circle at 30% 25%, ${t.bg}, ${t.bg} 55%, rgba(0,0,0,.35) 140%)`, color: t.fg }}
    >
      {t.code}
    </span>
  );
}
