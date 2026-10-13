"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that counts up when it scrolls into view. The server renders the final value (so it is correct without
 * JavaScript, in search results and in tests); the animation is a flourish on top. Respects reduced-motion.
 */
export default function CountUp({ value, decimals = 0, duration = 1100, prefix = "", suffix = "", className = "" }: { value: number; decimals?: number; duration?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    setShown(0);
    const run = () => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      // if the tab is in the background the browser pauses animation frames; guarantee the final value anyway
      timer = setTimeout(() => setShown(value), duration + 400);
      const tick = (now: number) => {
        const p = Math.min(1, Math.max(0, (now - t0) / duration));
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(value * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && run(), { threshold: 0.3 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {Math.max(0, shown).toFixed(decimals)}
      {suffix}
    </span>
  );
}
