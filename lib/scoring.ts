// NB: deliberately not importing the `Pick` row type here — it would shadow
// TypeScript's built-in Pick<T, K>, which this file leans on heavily.
import type { Game, Player } from "./db/schema";

export type Side = "home" | "away";
export type PickResult = "win" | "loss" | "push";

/** The line a pick is graded against: frozen at kickoff, live before that. */
export function effectiveSpread(game: Pick<Game, "lockedSpread" | "spread">): number | null {
  return game.lockedSpread ?? game.spread ?? null;
}

/**
 * How many points the chosen side is beating the spread by. Positive covers,
 * negative doesn't, zero is a push. Works mid-game too, which is what drives
 * the live "currently covering" state in the UI.
 */
export function coverMargin(
  game: Pick<Game, "homeScore" | "awayScore" | "lockedSpread" | "spread">,
  side: Side,
): number | null {
  if (game.homeScore === null || game.awayScore === null) return null;
  const spread = effectiveSpread(game);
  if (spread === null) return null;
  const adj = game.homeScore - game.awayScore + spread;
  return side === "home" ? adj : -adj;
}

export function gradePick(
  game: Pick<Game, "completed" | "homeScore" | "awayScore" | "lockedSpread" | "spread">,
  side: Side,
): PickResult | null {
  if (!game.completed) return null;
  const margin = coverMargin(game, side);
  if (margin === null) return null;
  if (margin > 0) return "win";
  if (margin < 0) return "loss";
  return "push";
}

/** Which side is currently covering, ignoring whether the game is over. */
export function coveringSide(
  game: Pick<Game, "homeScore" | "awayScore" | "lockedSpread" | "spread">,
): Side | "push" | null {
  const m = coverMargin(game, "home");
  if (m === null) return null;
  if (m > 0) return "home";
  if (m < 0) return "away";
  return "push";
}

export interface PlayerRecord {
  player: Player;
  wins: number;
  losses: number;
  pushes: number;
  points: number;
  pending: number;
  pct: number;
  /** Number of weeks this player finished with the outright best record. */
  weekWins: number;
  streak: number; // positive = win streak, negative = losing streak
}

/** A win is a point, a push is half. Straightforward and hard to argue about. */
export function pointsFor(r: PickResult): number {
  return r === "win" ? 1 : r === "push" ? 0.5 : 0;
}

interface GradedRow {
  playerId: number;
  week: number;
  kickoff: number;
  result: PickResult | null;
}

export function buildLeaderboard(players: Player[], rows: GradedRow[]): PlayerRecord[] {
  const byPlayer = new Map<number, GradedRow[]>();
  for (const r of rows) {
    const list = byPlayer.get(r.playerId) ?? [];
    list.push(r);
    byPlayer.set(r.playerId, list);
  }

  // Weekly champions: best points total in a week, outright only (ties give no
  // one the crown — keeps the stat meaningful).
  const weekWins = new Map<number, number>();
  const weeks = new Set(rows.map((r) => r.week));
  for (const week of weeks) {
    const inWeek = rows.filter((r) => r.week === week);
    if (!inWeek.some((r) => r.result !== null)) continue;
    const totals = new Map<number, number>();
    for (const r of inWeek) {
      if (!r.result) continue;
      totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + pointsFor(r.result));
    }
    if (totals.size === 0) continue;
    const best = Math.max(...totals.values());
    const leaders = [...totals.entries()].filter(([, v]) => v === best);
    if (leaders.length === 1 && best > 0) {
      weekWins.set(leaders[0][0], (weekWins.get(leaders[0][0]) ?? 0) + 1);
    }
  }

  const records = players.map((player) => {
    const mine = (byPlayer.get(player.id) ?? []).sort((a, b) => a.kickoff - b.kickoff);
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let pending = 0;
    for (const r of mine) {
      if (r.result === "win") wins++;
      else if (r.result === "loss") losses++;
      else if (r.result === "push") pushes++;
      else pending++;
    }

    // Streak over decided picks only, most recent first.
    let streak = 0;
    for (let i = mine.length - 1; i >= 0; i--) {
      const r = mine[i].result;
      if (r === null || r === "push") continue;
      if (streak === 0) streak = r === "win" ? 1 : -1;
      else if (r === "win" && streak > 0) streak++;
      else if (r === "loss" && streak < 0) streak--;
      else break;
    }

    const decided = wins + losses + pushes;
    return {
      player,
      wins,
      losses,
      pushes,
      pending,
      points: wins + pushes * 0.5,
      pct: decided ? (wins + pushes * 0.5) / decided : 0,
      weekWins: weekWins.get(player.id) ?? 0,
      streak,
    };
  });

  return records.sort(
    (a, b) => b.points - a.points || b.pct - a.pct || b.wins - a.wins || a.player.sort - b.player.sort,
  );
}
