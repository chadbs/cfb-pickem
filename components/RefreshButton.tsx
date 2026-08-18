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
      title="Refresh scores and lines"
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
      className="ctl grid h-8 w-8 place-items-center disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-[14px] w-[14px] ${pending ? "animate-spin" : ""}`}
        style={{ color: failed ? "var(--loss)" : undefined }}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
