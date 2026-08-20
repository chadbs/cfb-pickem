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
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  /**
   * The default view is the conferences we care about; "All FBS" opens it up to
   * independents (Notre Dame), the MAC, Sun Belt, CUSA and the American. A game
   * already on the slate always shows, whatever the filter, so a hand-picked
   * one can never quietly vanish.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (!showAll && !c.preferred && !c.selected) return false;
      if (!q) return true;
      return (
        c.awayAbbr.toLowerCase().includes(q) ||
        c.homeAbbr.toLowerCase().includes(q) ||
        c.awayName.toLowerCase().includes(q) ||
        c.homeName.toLowerCase().includes(q) ||
        c.confLabel.toLowerCase().includes(q)
      );
    });
  }, [candidates, query, showAll]);

  const initial = useMemo(
    () => new Set(candidates.filter((c) => c.selected).map((c) => c.espnId)),
    [candidates],
  );
  const dirty =
    chosen.size !== initial.size || [...chosen].some((id) => !initial.has(id));

  const full = chosen.size >= GAMES_PER_WEEK;

  // Games being dropped that somebody has already picked. Reversible — the
  // picks are kept — but worth saying out loud before it happens.
  const droppingPicked = candidates.filter(
    (c) => c.selected && !chosen.has(c.espnId) && c.pickCount > 0,
  );
  const picksAffected = droppingPicked.reduce((n, c) => n + c.pickCount, 0);

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

      {picksAffected > 0 && (
        <div
          className="mb-3 rounded-[var(--r-card)] border px-3 py-2.5 text-[12.5px] leading-relaxed"
          style={{
            borderColor: "color-mix(in srgb, var(--push) 40%, transparent)",
            background: "color-mix(in srgb, var(--push) 9%, transparent)",
          }}
        >
          Removing{" "}
          <strong className="font-semibold">
            {droppingPicked.map((c) => `${c.awayAbbr} @ ${c.homeAbbr}`).join(", ")}
          </strong>{" "}
          will stop {picksAffected} existing pick{picksAffected === 1 ? "" : "s"} counting.
          Nothing is deleted — put the game back and the picks count again.
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Filter games</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by team or conference…"
            className="ctl h-8 w-full px-2.5 text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
          />
        </label>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-pressed={showAll}
          className="ctl h-8 shrink-0 px-2.5 text-[12.5px] font-medium"
          style={
            showAll
              ? {
                  borderColor: "color-mix(in srgb, var(--brand) 55%, transparent)",
                  color: "var(--ink)",
                }
              : undefined
          }
        >
          All FBS
        </button>
        <span className="nums shrink-0 text-[11.5px] text-[var(--ink-faint)]">
          {visible.length} of {candidates.length}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {visible.length === 0 && (
          <li className="card px-3 py-6 text-center text-[12.5px] text-[var(--ink-faint)]">
            Nothing matches “{query}”.
          </li>
        )}
        {visible.map((c) => (
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
        Every game from the Big Ten, SEC, Big 12, Pac-12, ACC, Mountain West and
        the independents — which is where Notre Dame lives. Ordered by our four
        teams first, then any top-25 game best ranks first, then conference, with
        lopsided lines pushed toward the bottom. &ldquo;All FBS&rdquo; adds the MAC,
        Sun Belt, CUSA and the American. Only a game that has already kicked off
        can&apos;t be changed. Swapping out a game that has picks on it keeps them:
        they stop counting, and count again if you put the game back.
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
          {c.confLabel && <span className="truncate">{c.confLabel}</span>}
          {c.broadcast && <span>{c.broadcast}</span>}
        </span>

        <span className="nums w-[52px] shrink-0 text-right text-[12px] font-semibold text-[var(--ink-dim)]">
          {c.spread === null ? "—" : c.spread === 0 ? "PK" : formatSpread(c.spread)}
        </span>

        <span className="nums w-[58px] shrink-0 text-right text-[11px] text-[var(--ink-faint)]">
          {when}
        </span>

        <span className="w-[46px] shrink-0 text-right text-[10px]">
          {c.locked ? (
            <span className="text-[var(--ink-faint)]" title="Kicked off — can't be changed">
              started
            </span>
          ) : c.pickCount > 0 ? (
            <span
              className="text-[var(--push)]"
              title={`${c.pickCount} pick${c.pickCount === 1 ? "" : "s"} on this game`}
            >
              {c.pickCount} pick{c.pickCount === 1 ? "" : "s"}
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
