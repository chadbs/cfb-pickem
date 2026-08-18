"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { resetSlate, setSlate } from "@/app/actions";
import { GAMES_PER_WEEK } from "@/lib/config";
import { formatSpread, formatTime } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";
import type { CandidateView } from "@/lib/view-types";

export function SlateEditor({
  season,
  week,
  candidates,
}: {
  season: number;
  week: number;
  candidates: CandidateView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => c.selected).map((c) => c.espnId)),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const initial = useMemo(
    () => new Set(candidates.filter((c) => c.selected).map((c) => c.espnId)),
    [candidates],
  );
  const dirty =
    chosen.size !== initial.size || [...chosen].some((id) => !initial.has(id));

  const full = chosen.size >= GAMES_PER_WEEK;

  function toggle(c: CandidateView) {
    if (c.locked) return;
    if (!chosen.has(c.espnId) && full) {
      // Explaining beats a dead disabled row you can't interact with.
      setMessage({ ok: false, text: `That's ${GAMES_PER_WEEK} — uncheck one to swap this in` });
      return;
    }
    setMessage(null);
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(c.espnId)) next.delete(c.espnId);
      else next.add(c.espnId);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await setSlate(season, week, [...chosen]);
      setMessage(
        res.ok
          ? { ok: true, text: "Slate saved" }
          : { ok: false, text: res.error ?? "Could not save" },
      );
      if (res.ok) router.refresh();
    });
  }

  function reset() {
    startTransition(async () => {
      const res = await resetSlate(season, week);
      setMessage(
        res.ok
          ? { ok: true, text: "Reset to the automatic slate" }
          : { ok: false, text: res.error ?? "Could not reset" },
      );
      router.refresh();
    });
  }

  return (
    <>
      <div className="card sticky top-[calc(var(--header-h)+0.5rem)] z-30 mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">
            <span className={chosen.size === GAMES_PER_WEEK ? "" : "text-[var(--push)]"}>
              {chosen.size}
            </span>
            <span className="text-[var(--ink-faint)]">/{GAMES_PER_WEEK} games</span>
          </p>
          <p className="text-[11.5px] leading-tight text-[var(--ink-faint)]">
            {full ? "Uncheck one to swap another in" : "Pick the games for this week"}
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
            onClick={reset}
            disabled={pending}
            className="ctl h-8 px-2.5 text-[12.5px] font-medium disabled:opacity-50"
          >
            Auto
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty || chosen.size === 0}
            className="h-8 rounded-[var(--r-ctl)] px-3 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--brand)" }}
          >
            {pending ? "Saving…" : "Save slate"}
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {candidates.map((c) => (
          <Row
            key={c.espnId}
            c={c}
            checked={chosen.has(c.espnId)}
            blocked={!chosen.has(c.espnId) && full}
            onToggle={() => toggle(c)}
          />
        ))}
      </ul>

      <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--ink-faint)]">
        Ranked by the auto-picker: home teams first, then ranked matchups, tight
        lines and national TV. A game someone has already picked, or one that has
        kicked off, can&apos;t be removed.
      </p>
    </>
  );
}

function Row({
  c,
  checked,
  blocked,
  onToggle,
}: {
  c: CandidateView;
  checked: boolean;
  blocked: boolean;
  onToggle: () => void;
}) {
  const isClient = useIsClient();
  const when = isClient
    ? formatTime(c.kickoff)
    : `${formatTime(c.kickoff, "America/New_York")} ET`;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={c.locked}
        aria-pressed={checked}
        className={`card flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors ${
          c.locked ? "cursor-default opacity-45" : "hover:border-[var(--line-strong)]"
        } ${blocked ? "opacity-60" : ""}`}
        style={
          checked
            ? {
                borderColor: "color-mix(in srgb, var(--brand) 55%, transparent)",
                background: "color-mix(in srgb, var(--brand) 8%, var(--card-bg))",
              }
            : undefined
        }
      >
        <span
          aria-hidden
          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border"
          style={{
            borderColor: checked ? "var(--brand)" : "var(--line-strong)",
            background: checked ? "var(--brand)" : "transparent",
          }}
        >
          {checked && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <Logo src={c.awayLogo} />
          <span className="truncate text-[13px] font-semibold">
            {c.awayRank && <span className="nums mr-0.5 text-[9.5px] text-[var(--push)]">{c.awayRank}</span>}
            {c.awayAbbr}
          </span>
          <span className="text-[10.5px] text-[var(--ink-faint)]">{c.neutralSite ? "vs" : "@"}</span>
          <Logo src={c.homeLogo} />
          <span className="truncate text-[13px] font-semibold">
            {c.homeRank && <span className="nums mr-0.5 text-[9.5px] text-[var(--push)]">{c.homeRank}</span>}
            {c.homeAbbr}
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-2 text-[11px] text-[var(--ink-faint)] sm:flex">
          {c.favorite && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: "color-mix(in srgb, var(--push) 15%, transparent)", color: "var(--push)" }}
            >
              {c.favorite}
            </span>
          )}
          {c.broadcast && <span>{c.broadcast}</span>}
        </span>

        <span className="nums w-[52px] shrink-0 text-right text-[12px] font-semibold text-[var(--ink-dim)]">
          {c.spread === null ? "—" : c.spread === 0 ? "PK" : formatSpread(c.spread)}
        </span>

        <span className="nums w-[58px] shrink-0 text-right text-[11px] text-[var(--ink-faint)]">
          {when}
        </span>

        <span className="w-[42px] shrink-0 text-right text-[10px]">
          {c.locked ? (
            <span className="text-[var(--ink-faint)]" title={c.pickCount > 0 ? `${c.pickCount} picks` : "Kicked off"}>
              {c.pickCount > 0 ? `${c.pickCount} pick${c.pickCount === 1 ? "" : "s"}` : "started"}
            </span>
          ) : c.recommended ? (
            <span className="text-[var(--brand)]" title="Would be chosen automatically">
              top 10
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function Logo({ src }: { src: string | null }) {
  if (!src) return <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-white/5" />;
  return (
    <Image src={src} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0 object-contain" unoptimized />
  );
}
