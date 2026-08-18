"use client";

import Image from "next/image";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { motion } from "motion/react";
import { setPick } from "@/app/actions";
import { Avatar } from "./Avatar";
import { readableTeamColor } from "@/lib/color";
import { formatSpread, formatTime, spreadForSide } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";
import type { PickResult, Side } from "@/lib/scoring";
import type { GamePick, GameView, PlayerView, TeamView } from "@/lib/view-types";

export function GameCard({
  game,
  players,
  meId,
}: {
  game: GameView;
  players: PlayerView[];
  meId: number | null;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const [picks, applyOptimistic] = useOptimistic(
    game.picks,
    (state: GamePick[], next: { playerId: number; side: Side }) => {
      const mine = state.find((p) => p.playerId === next.playerId);
      const others = state.filter((p) => p.playerId !== next.playerId);
      // Tapping the side you're already on clears the pick.
      if (mine?.side === next.side) return others;
      return [
        ...others,
        {
          playerId: next.playerId,
          side: next.side,
          result: null,
          liveCovering: false,
          // You take the number that's on screen right now.
          lockedAt: game.gradingSpread,
          lineMoved: false,
        },
      ];
    },
  );

  // Only the person selected in the header can change anything here.
  const editable = !game.locked && meId !== null;

  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(0), 1800);
    return () => clearTimeout(t);
  }, [savedAt]);

  function pick(side: Side) {
    if (!editable) return;
    setError(null);
    startTransition(async () => {
      applyOptimistic({ playerId: meId!, side });
      const res = await setPick(meId!, game.id, side);
      if (res.ok) setSavedAt(Date.now());
      else setError(res.error ?? "Something went wrong");
    });
  }

  const playerById = new Map(players.map((p) => [p.id, p]));

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
      className="card flex flex-col overflow-hidden"
    >
      <GameHeader game={game} saved={savedAt !== 0} />

      {/* away @ home, with the separator spelled out so a card reads as one
          matchup rather than two loose tiles sitting next to each other. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5 px-2.5 pb-2.5">
        <SideButton
          game={game}
          side="away"
          picks={picks}
          playerById={playerById}
          meId={meId}
          editable={editable}
          onPick={pick}
        />
        <span className="self-center text-[10.5px] font-medium lowercase text-[var(--ink-faint)]">
          {game.neutralSite ? "vs" : "@"}
        </span>
        <SideButton
          game={game}
          side="home"
          picks={picks}
          playerById={playerById}
          meId={meId}
          editable={editable}
          onPick={pick}
        />
      </div>

      {error && <p className="px-3 pb-2.5 text-[11.5px] text-[var(--loss)]">{error}</p>}
    </motion.article>
  );
}

/* ------------------------------------------------------------------ header */

function GameHeader({ game, saved }: { game: GameView; saved: boolean }) {
  // The day is carried by the group heading, so the card only needs a time.
  const isClient = useIsClient();
  const when = isClient
    ? formatTime(game.kickoff)
    : `${formatTime(game.kickoff, "America/New_York")} ET`;

  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-2.5 text-[11px]">
      {game.status === "in" ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold text-[var(--live)]"
          style={{ background: "color-mix(in srgb, var(--live) 14%, transparent)" }}
        >
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />
          {game.statusDetail ?? "LIVE"}
        </span>
      ) : game.completed ? (
        <span className="rounded-md border border-[var(--line)] px-1.5 py-0.5 font-medium text-[var(--ink-faint)]">
          Final
        </span>
      ) : (
        <span className="nums font-medium text-[var(--ink-dim)]">{when}</span>
      )}

      <span className="ml-auto flex min-w-0 items-center gap-2 text-[var(--ink-faint)]">
        {saved ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1 font-medium text-[var(--win)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-2.5 w-2.5"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Saved
          </motion.span>
        ) : (
          <>
            {game.broadcast && <span className="truncate">{game.broadcast}</span>}
            {game.overUnder && <span className="nums hidden sm:inline">O/U {game.overUnder}</span>}
          </>
        )}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------- side */

function SideButton({
  game,
  side,
  picks,
  playerById,
  meId,
  editable,
  onPick,
}: {
  game: GameView;
  side: Side;
  picks: GamePick[];
  playerById: Map<number, PlayerView>;
  meId: number | null;
  editable: boolean;
  onPick: (side: Side) => void;
}) {
  const team: TeamView = side === "home" ? game.home : game.away;
  const spread = spreadForSide(game.gradingSpread, side);
  const teamColor = readableTeamColor(team.color);

  const sidePicks = picks.filter((p) => p.side === side).sort((a, b) => a.playerId - b.playerId);
  const isMine = meId !== null && sidePicks.some((p) => p.playerId === meId);

  /**
   * The side's own styling reflects the closing line — that's a fact about the
   * game. Individual results can differ from it, because each pick is settled
   * at the number its owner took, so those live on the avatars instead.
   */
  const sideResult: PickResult | null = game.completed
    ? game.covering === "push"
      ? "push"
      : game.covering === side
        ? "win"
        : "loss"
    : null;

  const liveCovering = game.status === "in" && game.covering === side;

  return (
    <button
      type="button"
      onClick={() => onPick(side)}
      disabled={!editable}
      aria-pressed={isMine}
      aria-label={`Pick ${team.name} ${spread === null ? "" : formatSpread(spread)}`}
      className="side flex flex-col gap-2 p-2.5 text-left"
      data-picked={isMine}
      data-editable={editable}
      data-result={sideResult ?? undefined}
      style={{ ["--team" as string]: teamColor }}
    >
      <div className="flex items-start gap-2">
        {team.logo ? (
          <Image
            src={team.logo}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 object-contain"
            unoptimized
          />
        ) : (
          <span className="h-7 w-7 shrink-0 rounded-full bg-white/5" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            {team.rank && (
              <span className="nums text-[10px] font-bold text-[var(--push)]">{team.rank}</span>
            )}
            <span className="truncate text-[14px] font-semibold leading-tight tracking-[-0.01em]">
              {team.abbr}
            </span>
          </div>
          <div className="nums truncate text-[10.5px] leading-tight text-[var(--ink-faint)]">
            {/* Preseason every record is 0-0 — pure noise, so hide it. */}
            {team.record && team.record !== "0-0" ? team.record : " "}
          </div>
        </div>

        {team.score !== null && (
          <span
            className={`nums text-[21px] font-semibold leading-none ${
              liveCovering || sideResult === "win" ? "text-[var(--ink)]" : "text-[var(--ink-dim)]"
            }`}
          >
            {team.score}
          </span>
        )}
      </div>

      {/* Line on the left, whoever took this side on the right. Sharing one row
          keeps a pre-kickoff card from carrying two mostly-empty rows. */}
      <div className="flex min-h-[22px] flex-wrap items-center gap-x-1.5 gap-y-1">
        <span
          className="nums rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold"
          style={{
            color: spread === null ? "var(--ink-faint)" : teamColor,
            background:
              spread === null ? "transparent" : `color-mix(in srgb, ${teamColor} 13%, transparent)`,
          }}
        >
          {spread === null ? "no line" : formatSpread(spread)}
        </span>

        {liveCovering && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[var(--win)]"
            style={{ background: "color-mix(in srgb, var(--win) 13%, transparent)" }}
          >
            covering
          </span>
        )}

        {/* The shared layoutId glides an avatar across the card when someone
            flips sides instead of popping it out and back in. */}
        <span className="ml-auto flex items-center gap-1">
          {sidePicks.map((p) => {
            const player = playerById.get(p.playerId);
            if (!player) return null;
            const theirs = spreadForSide(p.lockedAt, side);
            const theirLine = theirs === null ? "" : ` ${formatSpread(theirs)}`;
            return (
              <motion.span
                key={p.playerId}
                layoutId={`pick-${game.id}-${p.playerId}`}
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
                className="flex items-center gap-0.5"
              >
                <Avatar
                  player={player}
                  size={21}
                  result={p.result}
                  isMe={p.playerId === meId}
                  title={`${player.name} · ${team.abbr}${theirLine}`}
                />
                {/* Only shown when they're holding a different number to the
                    one on the board, so the discrepancy is never hidden. */}
                {p.lineMoved && theirs !== null && (
                  <span className="nums text-[9.5px] font-bold" style={{ color: player.accent }}>
                    {formatSpread(theirs)}
                  </span>
                )}
              </motion.span>
            );
          })}
        </span>
      </div>
    </button>
  );
}
