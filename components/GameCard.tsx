"use client";

import Image from "next/image";
import { useOptimistic, useState, useTransition } from "react";
import { motion } from "motion/react";
import { setPick } from "@/app/actions";
import { Avatar } from "./Avatar";
import { readableTeamColor } from "@/lib/color";
import { useIsClient } from "@/lib/use-is-client";
import { formatKickoffLong, formatSpread, spreadForSide } from "@/lib/format";
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

  const [picks, applyOptimistic] = useOptimistic(
    game.picks,
    (state: GamePick[], next: { playerId: number; side: Side }) => {
      const mine = state.find((p) => p.playerId === next.playerId);
      const others = state.filter((p) => p.playerId !== next.playerId);
      // Tapping the side you're already on clears the pick.
      if (mine?.side === next.side) return others;
      return [...others, { playerId: next.playerId, side: next.side, result: null, liveCovering: false }];
    },
  );

  function pick(side: Side) {
    if (game.locked || meId === null) return;
    setError(null);
    startTransition(async () => {
      applyOptimistic({ playerId: meId, side });
      const res = await setPick(meId, game.id, side);
      if (!res.ok) setError(res.error ?? "Something went wrong");
    });
  }

  const playerById = new Map(players.map((p) => [p.id, p]));

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      className="card overflow-hidden"
    >
      <GameHeader game={game} />

      <div className="grid grid-cols-2 gap-2 p-2 pt-0">
        <SideButton
          game={game}
          side="away"
          picks={picks}
          playerById={playerById}
          meId={meId}
          onPick={pick}
        />
        <SideButton
          game={game}
          side="home"
          picks={picks}
          playerById={playerById}
          meId={meId}
          onPick={pick}
        />
      </div>

      {error && (
        <p className="px-3 pb-2.5 text-[11px] text-[var(--loss)]">{error}</p>
      )}
    </motion.article>
  );
}

/* ------------------------------------------------------------------ header */

function GameHeader({ game }: { game: GameView }) {
  // Server renders Eastern — the sport's default and a stable value for every
  // viewer — then the browser swaps in the local zone once hydrated.
  const isClient = useIsClient();
  const when = isClient
    ? formatKickoffLong(game.kickoff)
    : `${formatKickoffLong(game.kickoff, "America/New_York")} ET`;

  const ou = game.overUnder ? `O/U ${game.overUnder}` : null;

  return (
    <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 text-[11px] text-[var(--ink-faint)]">
      {game.status === "in" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--live)_16%,transparent)] px-2 py-0.5 font-semibold tracking-wide text-[var(--live)]">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />
          {game.statusDetail ?? "LIVE"}
        </span>
      ) : game.completed ? (
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-semibold tracking-wide text-[var(--ink-dim)]">
          FINAL
        </span>
      ) : (
        <span className="nums font-medium text-[var(--ink-dim)]">{when}</span>
      )}

      <span className="ml-auto flex items-center gap-2 truncate">
        {game.selectionReason && (
          <span className="hidden truncate text-[var(--ink-faint)] sm:inline">
            {game.selectionReason}
          </span>
        )}
        {game.broadcast && <span className="text-[var(--ink-faint)]">{game.broadcast}</span>}
        {ou && <span className="nums text-[var(--ink-faint)]">{ou}</span>}
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
  onPick,
}: {
  game: GameView;
  side: Side;
  picks: GamePick[];
  playerById: Map<number, PlayerView>;
  meId: number | null;
  onPick: (side: Side) => void;
}) {
  const team: TeamView = side === "home" ? game.home : game.away;
  const spread = spreadForSide(game.gradingSpread, side);
  const teamColor = readableTeamColor(team.color);

  const sidePicks = picks
    .filter((p) => p.side === side)
    .sort((a, b) => a.playerId - b.playerId);
  const isMine = meId !== null && sidePicks.some((p) => p.playerId === meId);

  // Once final, the side that covered wins for everyone who took it.
  const result: PickResult | null = game.completed
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
      disabled={game.locked || meId === null}
      aria-pressed={isMine}
      aria-label={`Pick ${team.name} ${spread === null ? "" : formatSpread(spread)}`}
      className="side flex flex-col gap-2 p-2.5 text-left disabled:cursor-default"
      data-picked={isMine}
      data-locked={game.locked}
      data-result={result ?? undefined}
      style={{ ["--team" as string]: teamColor }}
    >
      <div className="flex items-start gap-2">
        {team.logo ? (
          <Image
            src={team.logo}
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] shrink-0 object-contain"
            unoptimized
          />
        ) : (
          <span className="h-[30px] w-[30px] shrink-0 rounded-full bg-white/5" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            {team.rank && (
              <span className="nums text-[10px] font-bold text-[var(--push)]">{team.rank}</span>
            )}
            <span className="truncate text-[15px] font-semibold leading-tight">{team.abbr}</span>
          </div>
          <div className="nums truncate text-[10.5px] text-[var(--ink-faint)]">
            {team.record ?? " "}
          </div>
        </div>

        {team.score !== null && (
          <span
            className={`nums text-[22px] font-bold leading-none tabular-nums ${
              liveCovering || result === "win" ? "text-[var(--ink)]" : "text-[var(--ink-dim)]"
            }`}
          >
            {team.score}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className="nums rounded-md px-1.5 py-0.5 text-[13px] font-bold"
          style={{
            color: spread === null ? "var(--ink-faint)" : teamColor,
            background:
              spread === null ? "transparent" : `color-mix(in srgb, ${teamColor} 14%, transparent)`,
          }}
        >
          {spread === null ? "no line" : formatSpread(spread)}
        </span>

        {liveCovering && (
          <span className="rounded-md bg-[color-mix(in_srgb,var(--win)_15%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--win)]">
            covering
          </span>
        )}
      </div>

      {/* Who's on this side. The layoutId makes an avatar glide across the card
          when someone flips their pick rather than popping out and back in. */}
      <div className="flex min-h-[22px] flex-wrap items-center gap-1">
        {sidePicks.map((p) => {
          const player = playerById.get(p.playerId);
          if (!player) return null;
          return (
            <motion.span
              key={p.playerId}
              layoutId={`pick-${game.id}-${p.playerId}`}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
            >
              <Avatar
                player={player}
                size={22}
                result={result}
                isMe={p.playerId === meId}
                title={`${player.name} · ${team.abbr}`}
              />
            </motion.span>
          );
        })}
      </div>
    </button>
  );
}
