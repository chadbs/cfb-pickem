"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { chalkMyBracket, setBracketPick } from "@/app/actions";
import { Avatar } from "./Avatar";
import { readableTeamColor } from "@/lib/color";
import { formatKickoffLong, shortEventName } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";
import { ROUND_NAMES, ROUND_ORDER, SLOTS, type BracketTeam, type Round, type SlotId } from "@/lib/bracket";
import type { BracketEntry, PlayoffView, SlotGame } from "@/lib/playoff";

const TOTAL_GAMES = SLOTS.length;

export function BracketBoard({ view, meId }: { view: PlayoffView; meId: number | null }) {
  const [viewing, setViewing] = useState<number | null>(meId ?? view.entries[0]?.player.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const entry = view.entries.find((e) => e.player.id === viewing) ?? view.entries[0];
  if (!entry) return null;

  const mine = entry.player.id === meId;
  const editable = mine && !view.locked;

  function pick(slot: SlotId, teamId: string) {
    if (!editable) return;
    setError(null);
    startTransition(async () => {
      const res = await setBracketPick(entry.player.id, view.season, slot, teamId);
      if (!res.ok) setError(res.error ?? "Could not save that pick");
    });
  }

  function fillChalk() {
    if (!editable) return;
    setError(null);
    startTransition(async () => {
      const res = await chalkMyBracket(entry.player.id, view.season);
      if (!res.ok) setError(res.error ?? "Could not fill the bracket");
    });
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
      <div className="min-w-0">
        {/* Whose bracket you're looking at. Everyone can see everyone's, as
            with the weekly picks; only your own is editable. */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {view.entries.map((e) => {
            const active = e.player.id === entry.player.id;
            return (
              <button
                key={e.player.id}
                type="button"
                onClick={() => setViewing(e.player.id)}
                aria-pressed={active}
                className="relative flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12.5px] font-medium transition-colors"
                style={{ color: active ? "var(--ink)" : "var(--ink-faint)" }}
              >
                {active && (
                  <motion.span
                    layoutId="bracket-who"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    className="absolute inset-0 rounded-[8px] bg-white/[0.09]"
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Avatar player={e.player} size={20} isMe={e.player.id === meId} />
                  {e.player.name}
                  {e.player.id === meId && <span className="text-[var(--ink-faint)]">· you</span>}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mb-2 text-[12px] text-[var(--loss)]" role="alert">
            {error}
          </p>
        )}

        {editable && entry.filled < TOTAL_GAMES && (
          <div className="card mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed">
              <strong className="font-semibold">
                {TOTAL_GAMES - entry.filled} game{TOTAL_GAMES - entry.filled === 1 ? "" : "s"} left
              </strong>{" "}
              <span className="text-[var(--ink-faint)]">
                — tap a team to send them through. Later rounds open up as you go.
              </span>
            </p>
            <button
              type="button"
              onClick={fillChalk}
              className="ctl h-8 shrink-0 px-2.5 text-[12px] font-medium"
            >
              Fill with chalk
            </button>
          </div>
        )}

        {!mine && (
          <p className="mb-3 text-[12px] text-[var(--ink-faint)]">
            {entry.player.name}&apos;s bracket{entry.auto ? " — filled in automatically at kickoff" : ""}.
          </p>
        )}

        <div className="flex flex-col gap-4">
          {ROUND_ORDER.map((round) => (
            <RoundBlock
              key={round}
              round={round}
              view={view}
              entry={entry}
              editable={editable}
              onPick={pick}
            />
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h)+1.25rem)]">
        <Scoreboard view={view} viewing={entry.player.id} meId={meId} onView={setViewing} />
        <Rules view={view} />
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- a round */

function RoundBlock({
  round,
  view,
  entry,
  editable,
  onPick,
}: {
  round: Round;
  view: PlayoffView;
  entry: BracketEntry;
  editable: boolean;
  onPick: (slot: SlotId, teamId: string) => void;
}) {
  const slots = SLOTS.filter((s) => s.round === round);
  return (
    <section>
      <div className="mb-1.5 flex items-baseline gap-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-dim)]">
          {ROUND_NAMES[round]}
        </h2>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <div className={`grid gap-2.5 ${round === "final" ? "" : "sm:grid-cols-2"}`}>
        {slots.map((def) => {
          const i = SLOTS.findIndex((s) => s.id === def.id);
          return (
            <Matchup
              key={def.id}
              slot={def.id}
              label={def.label}
              game={view.slotGames[def.id]}
              a={entry.resolved[i].a}
              b={entry.resolved[i].b}
              picked={entry.resolved[i].winner}
              actual={view.resultsResolved[i].winner}
              points={entry.score.slots[i]}
              editable={editable}
              onPick={onPick}
            />
          );
        })}
      </div>
    </section>
  );
}

function Matchup({
  slot,
  label,
  game,
  a,
  b,
  picked,
  actual,
  points,
  editable,
  onPick,
}: {
  slot: SlotId;
  label: string;
  game: SlotGame | undefined;
  a: BracketTeam | null;
  b: BracketTeam | null;
  picked: BracketTeam | null;
  actual: BracketTeam | null;
  points: BracketEntry["score"]["slots"][number];
  editable: boolean;
  onPick: (slot: SlotId, teamId: string) => void;
}) {
  const isClient = useIsClient();
  const event = shortEventName(game?.notes ?? null);
  const when = game
    ? isClient
      ? formatKickoffLong(game.kickoff)
      : `${formatKickoffLong(game.kickoff, "America/New_York")} ET`
    : null;

  const scoreFor = (t: BracketTeam | null) => {
    if (!game || !t) return null;
    if (game.homeTeamId === t.teamId) return game.homeScore;
    if (game.awayTeamId === t.teamId) return game.awayScore;
    return null;
  };

  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 pt-2 text-[10.5px]">
        <span className="font-semibold uppercase tracking-[0.05em] text-[var(--ink-faint)]">{label}</span>
        {event && <span className="min-w-0 truncate text-[var(--push)]">{event}</span>}
        <span className="ml-auto shrink-0 text-[var(--ink-faint)]">
          {actual ? (
            points.correct ? (
              <span className="font-semibold text-[var(--win)]">
                +{points.points}
                {points.upsetBonus > 0 && (
                  <span className="ml-1 font-normal text-[var(--push)]">
                    incl. {points.upsetBonus} upset
                  </span>
                )}
              </span>
            ) : (
              <span className="font-medium text-[var(--loss)]">missed</span>
            )
          ) : (
            <span className="nums">{game?.status === "in" ? "live" : when}</span>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-1 p-1.5">
        {[a, b].map((team, i) => (
          <TeamRow
            key={team?.teamId ?? `tbd-${i}`}
            team={team}
            score={scoreFor(team)}
            isPick={Boolean(team && picked?.teamId === team.teamId)}
            isWinner={Boolean(team && actual?.teamId === team.teamId)}
            decided={Boolean(actual)}
            editable={editable && Boolean(team)}
            onClick={() => team && onPick(slot, team.teamId)}
          />
        ))}
      </div>
    </article>
  );
}

function TeamRow({
  team,
  score,
  isPick,
  isWinner,
  decided,
  editable,
  onClick,
}: {
  team: BracketTeam | null;
  score: number | null;
  isPick: boolean;
  isWinner: boolean;
  decided: boolean;
  editable: boolean;
  onClick: () => void;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px] text-[var(--ink-faint)]">
        <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-white/5" />
        To be decided
      </div>
    );
  }

  const accent = readableTeamColor(team.color);
  // Their pick is outlined; once the game is played, the outline turns green or
  // red so a bracket reads as a scorecard rather than a list of intentions.
  const tone = decided
    ? isPick
      ? isWinner
        ? "var(--win)"
        : "var(--loss)"
      : "transparent"
    : isPick
      ? accent
      : "transparent";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!editable}
      aria-pressed={isPick}
      className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors disabled:cursor-default"
      style={{
        border: `1px solid ${tone === "transparent" ? "var(--line)" : tone}`,
        background: isPick ? `color-mix(in srgb, ${tone} 10%, transparent)` : "transparent",
        opacity: decided && !isWinner ? 0.62 : 1,
      }}
    >
      <span className="nums w-3.5 shrink-0 text-[10px] font-bold text-[var(--ink-faint)]">
        {team.seed}
      </span>
      {team.logo ? (
        <Image
          src={team.logo}
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px] shrink-0 object-contain"
          unoptimized
        />
      ) : (
        <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-white/5" />
      )}
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{team.short}</span>
      {isWinner && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--win)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 shrink-0"
          aria-label="won"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {score !== null && (
        <span className="nums shrink-0 text-[13px] font-semibold text-[var(--ink-dim)]">{score}</span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------- the aside */

function Scoreboard({
  view,
  viewing,
  meId,
  onView,
}: {
  view: PlayoffView;
  viewing: number;
  meId: number | null;
  onView: (id: number) => void;
}) {
  const ranked = [...view.entries].sort(
    (x, y) => y.score.points - x.score.points || y.score.correct - x.score.correct,
  );
  const anyDecided = view.entries.some((e) => e.score.decided > 0);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
          Bracket standings
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
          {anyDecided ? "Points, then games called right" : "Nothing played yet"}
        </p>
      </div>
      <ul>
        {ranked.map((e, i) => (
          <li key={e.player.id}>
            <button
              type="button"
              onClick={() => onView(e.player.id)}
              className="flex w-full items-center gap-2.5 border-b border-[var(--line)] px-3 py-2 text-left last:border-b-0"
              style={
                e.player.id === viewing
                  ? { background: `color-mix(in srgb, ${e.player.accent} 8%, transparent)` }
                  : undefined
              }
            >
              <span className="nums w-3 shrink-0 text-[11px] text-[var(--ink-faint)]">{i + 1}</span>
              <Avatar player={e.player} size={22} isMe={e.player.id === meId} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {e.player.name}
                {e.auto && (
                  <span className="ml-1 text-[10.5px] text-[var(--ink-faint)]">auto</span>
                )}
              </span>
              <span className="nums shrink-0 text-right text-[12px] text-[var(--ink-faint)]">
                {e.filled}/{TOTAL_GAMES}
              </span>
              <span className="nums w-7 shrink-0 text-right text-[13px] font-semibold">
                {anyDecided ? e.score.points : "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {anyDecided && (
        <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] text-[var(--ink-faint)]">
          {view.entries[0].score.remaining > 0
            ? `${view.entries[0].score.remaining} base points still on the table.`
            : "Every game is in."}
        </p>
      )}
    </section>
  );
}

function Rules({ view }: { view: PlayoffView }) {
  const isClient = useIsClient();
  const deadline = view.lockAt
    ? isClient
      ? formatKickoffLong(view.lockAt)
      : `${formatKickoffLong(view.lockAt, "America/New_York")} ET`
    : null;

  return (
    <section className="card px-3 py-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
        How it scores
      </h2>
      <ul className="mt-1.5 flex flex-col gap-1 text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
        <li>First round 1 point, quarterfinals 2, semifinals 4, the title game 8.</li>
        <li>
          A correct pick also pays the seed difference when the lower seed wins — a 12 over a 5 is
          worth 7 more. Backing an underdog that loses pays nothing.
        </li>
        <li>Straight winners, no spreads. 28 base points, 48 for a perfect 2025-style bracket.</li>
        <li>
          {view.locked
            ? "Brackets are locked — the playoff has started."
            : deadline
              ? `Locks at the first kickoff, ${deadline}.`
              : "Locks at the first playoff kickoff."}
        </li>
        <li>An unfinished bracket gets chalk filled in at the deadline, flagged as auto.</li>
      </ul>
    </section>
  );
}
