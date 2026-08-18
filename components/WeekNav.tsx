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
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Keep the selected week in view — week 13 shouldn't sit off-screen on a phone.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [week]);

  return (
    <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto">
      <span className="mr-1 hidden shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-faint)] lg:inline">
        Wk
      </span>
      {weeks.map((w) => {
        const isActive = w === week;
        return (
          <Link
            key={w}
            href={w === currentWeek ? "/" : `/?week=${w}`}
            ref={isActive ? activeRef : undefined}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`nums relative grid h-7 min-w-[28px] shrink-0 place-items-center rounded-[7px] px-1.5 text-[12.5px] font-medium transition-colors ${
              isActive
                ? "bg-white/[0.09] font-semibold text-[var(--ink)]"
                : "text-[var(--ink-faint)] hover:bg-white/[0.045] hover:text-[var(--ink-dim)]"
            }`}
          >
            {w}
            {w === currentWeek && !isActive && (
              <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-[var(--live)]" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
