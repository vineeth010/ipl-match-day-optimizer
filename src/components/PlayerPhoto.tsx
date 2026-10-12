"use client";

import { useState } from "react";

/* eslint-disable @next/next/no-img-element */
/** Shows /players/<slug>.jpg if the file exists; otherwise the placeholder (so the page never shows a broken image). */
export default function PlayerPhoto({ slug, alt, fallback }: { slug?: string; alt: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!slug || failed) return <div className="grid h-full w-full place-items-center text-white/85">{fallback}</div>;
  return <img src={`/players/${slug}.jpg`} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />;
}
