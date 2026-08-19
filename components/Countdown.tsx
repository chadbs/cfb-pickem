"use client";

import { useSyncExternalStore } from "react";
import { formatKickoffLong } from "@/lib/format";

/**
 * Ticks once a second on the client and returns 0 on the server, so the first
 * paint matches the markup and only then comes alive. Rounding to the interval
 * keeps the snapshot stable within a tick, which useSyncExternalStore requires.
 */
function useNow(intervalMs = 1000): number {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

/** Time until the week's next kickoff. Gives a quiet pre-season page a pulse. */
export function Countdown({ kickoff, label }: { kickoff: number; label: string }) {
  const now = useNow();
  const live = now > 0;
  const { d, h, m, s } = parts(kickoff - now);

  // Seconds only matter once it's close enough to care about.
  const value = !live ? "—" : d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;

  return (
    <div className="card mb-3 flex items-center gap-3 px-3 py-2">
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--brand) 16%, transparent)" }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-[13px] w-[13px]"
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 2h6" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="nums text-[15px] font-semibold tracking-[-0.012em]">{value}</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.055em] text-[var(--ink-faint)]">
            to first kickoff
          </span>
        </div>
        <div className="truncate text-[11.5px] text-[var(--ink-faint)]">
          {label} · {formatKickoffLong(kickoff, "America/New_York")} ET
        </div>
      </div>
    </div>
  );
}
