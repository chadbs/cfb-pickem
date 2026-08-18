"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Pulls fresh scores while games are running. The server does the actual ESPN
 * sync behind a throttle, so this just asks for a re-render on a timer and
 * whenever the tab comes back to the foreground.
 */
export function LiveRefresh({ active, intervalMs = 30_000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, intervalMs, router]);

  return null;
}
