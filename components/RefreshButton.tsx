"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshWeek } from "@/app/actions";

/** Forces an ESPN pull, bypassing the staleness throttle. */
export function RefreshButton({ season, week }: { season: number; week: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      aria-label="Refresh scores and lines"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setFailed(false);
          const res = await refreshWeek(season, week);
          if (!res.ok) setFailed(true);
          router.refresh();
        })
      }
      className="grid h-[26px] w-[26px] place-items-center rounded-lg bg-white/[0.07] text-[var(--ink-dim)] transition-colors hover:text-[var(--ink)] disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className={`h-[13px] w-[13px] ${pending ? "animate-spin" : ""}`}
        style={{ color: failed ? "var(--loss)" : undefined }}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
