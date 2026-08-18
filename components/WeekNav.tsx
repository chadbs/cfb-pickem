"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function WeekNav({
  weeks,
  week,
  currentWeek,
}: {
  weeks: number[];
  week: number;
  currentWeek: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Keep the selected week in view — week 11 shouldn't be off-screen on a phone.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [week]);

  return (
    <div ref={railRef} className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1">
      {weeks.map((w) => {
        const isActive = w === week;
        return (
          <Link
            key={w}
            href={w === currentWeek ? "/" : `/?week=${w}`}
            ref={isActive ? activeRef : undefined}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`nums relative shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-colors ${
              isActive
                ? "bg-white/[0.11] text-[var(--ink)]"
                : "text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
            }`}
          >
            {w}
            {w === currentWeek && !isActive && (
              <span className="absolute left-1/2 top-0.5 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--live)]" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
