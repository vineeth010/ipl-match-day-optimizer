"use client";

import Image from "next/image";
import { useState } from "react";
import assets from "@/lib/assets.json";

const PHOTOS = assets.players as Record<string, string>;

/**
 * Shows the photo dropped into public/players/ for this player (png, jpg, jpeg, webp or svg; the build scans the
 * folder), otherwise the placeholder, so the page never shows a broken image. Served through the Next.js image
 * optimizer, so large originals are resized and compressed automatically. The parent must be `relative` with a height.
 */
export default function PlayerPhoto({ slug, alt, fallback }: { slug?: string; alt: string; fallback: React.ReactNode }) {
  const file = slug ? PHOTOS[slug.toLowerCase()] : undefined;
  const [broken, setBroken] = useState(false);
  if (!file || broken) return <div className="grid h-full w-full place-items-center text-white/85">{fallback}</div>;
  return (
    <Image
      src={`/players/${file}`}
      alt={alt}
      fill
      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
      onError={() => setBroken(true)}
      className="object-cover object-top"
    />
  );
}
