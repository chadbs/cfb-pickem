"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { detectBracketField, setBracketField } from "@/app/actions";
import { BRACKET_SIZE } from "@/lib/config";
import type { TeamOption } from "@/lib/playoff";

const SEEDS = Array.from({ length: BRACKET_SIZE }, (_, i) => i + 1);

/**
 * Seeding the twelve-team playoff field. Detection does the work in a normal
 * year; the dropdowns are there for the year ESPN labels something oddly, and
 * because a wrong bracket is worse than a bit of typing.
 */
export function BracketFieldEditor({
  season,
  teams,
  current,
  locked,
  picksIn,
}: {
  season: number;
  teams: TeamOption[];
  /** Seed → team id, as stored. */
  current: Record<number, string>;
  /** The playoff has started; the field can't move any more. */
  locked: boolean;
  /** How many bracket picks are already in, across everyone. */
  picksIn: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seeds, setSeeds] = useState<Record<number, string>>(current);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const chosen = SEEDS.filter((s) => seeds[s]).length;
  const dirty = SEEDS.some((s) => (seeds[s] ?? "") !== (current[s] ?? ""));
  const byId = new Map(teams.map((t) => [t.teamId, t]));

  function detect() {
    setMessage(null);
    startTransition(async () => {
      const res = await detectBracketField(season);
      if (res.field?.length) {
        setSeeds(Object.fromEntries(res.field.map((t) => [t.seed, t.teamId])));
      }
      setMessage(
        res.ok
          ? { ok: true, text: "Detected — check it, then save" }
          : { ok: false, text: res.error ?? "Could not detect the field" },
      );
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const entries = SEEDS.filter((s) => seeds[s]).map((s) => ({ seed: s, teamId: seeds[s] }));
      const res = await setBracketField(season, entries);
      setMessage(
        res.ok
          ? { ok: true, text: "Field saved" }
          : { ok: false, text: res.error ?? "Could not save" },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="card mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
            Playoff field
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
            {locked
              ? "The playoff has started — the field is fixed"
              : `${chosen}/${BRACKET_SIZE} seeded · brackets are built from this`}
          </p>
        </div>

        {message && (
          <p
            className="text-[11.5px] font-medium"
            style={{ color: message.ok ? "var(--win)" : "var(--loss)" }}
          >
            {message.text}
          </p>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={detect}
            disabled={pending || locked}
            className="ctl h-8 px-2.5 text-[12.5px] font-medium disabled:opacity-50"
          >
            Detect
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || locked || !dirty || chosen !== BRACKET_SIZE}
            className="h-8 rounded-[var(--r-ctl)] px-3 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--brand)" }}
          >
            {pending ? "Saving…" : "Save field"}
          </button>
        </div>
      </div>

      {picksIn > 0 && !locked && (
        <p
          className="border-b border-[var(--line)] px-3 py-2 text-[11.5px] leading-relaxed"
          style={{ color: "var(--push)" }}
        >
          {picksIn} bracket pick{picksIn === 1 ? " is" : "s are"} already in. Re-seeding keeps every
          pick that still makes sense and drops the ones it contradicts.
        </p>
      )}

      <div className="grid gap-1.5 p-2 sm:grid-cols-2">
        {SEEDS.map((s) => {
          const team = seeds[s] ? byId.get(seeds[s]) : undefined;
          return (
            <label key={s} className="flex items-center gap-2">
              <span className="nums w-5 shrink-0 text-right text-[11px] font-bold text-[var(--ink-faint)]">
                {s}
              </span>
              <select
                value={seeds[s] ?? ""}
                disabled={locked}
                onChange={(e) => setSeeds((prev) => ({ ...prev, [s]: e.target.value }))}
                className="ctl h-8 min-w-0 flex-1 px-1.5 text-[12.5px] text-[var(--ink)] disabled:opacity-60"
              >
                <option value="">— pick a team —</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="nums w-11 shrink-0 text-[11px] text-[var(--ink-faint)]">
                {team?.abbr ?? ""}
              </span>
            </label>
          );
        })}
      </div>

      <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-faint)]">
        Seeds 1 to 4 get the byes. The bracket is built from the seeding itself — 5 v 12, 6 v 11,
        7 v 10, 8 v 9, and the top seed meets whoever comes out of 8/9 — so getting the seeds right
        is all there is to it. <strong className="font-medium">Detect</strong> reads them from
        ESPN&apos;s playoff games once the postseason is synced.
      </p>
    </section>
  );
}
