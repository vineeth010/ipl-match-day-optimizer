"use client";

import { useState } from "react";

/* eslint-disable @next/next/no-img-element */
const EXTENSIONS = ["jpg", "png", "jpeg", "webp"];

/**
 * Shows /players/<slug>.<ext> for the first extension that exists (jpg, png, jpeg, webp);
 * otherwise the placeholder, so the page never shows a broken image.
 */
export default function PlayerPhoto({ slug, alt, fallback }: { slug?: string; alt: string; fallback: React.ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  if (!slug || attempt >= EXTENSIONS.length) return <div className="grid h-full w-full place-items-center text-white/85">{fallback}</div>;
  return <img key={attempt} src={`/players/${slug}.${EXTENSIONS[attempt]}`} alt={alt} loading="lazy" onError={() => setAttempt((a) => a + 1)} className="h-full w-full object-cover object-top" />;
}
