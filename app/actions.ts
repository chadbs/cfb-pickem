"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db, ready, schema } from "@/lib/db";
import { autoSelectWeek, setSlatePinned, syncWeek } from "@/lib/sync";
import { GAMES_PER_WEEK } from "@/lib/config";

const { games, picks, players } = schema;

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Make or change a pick. There's no auth by design — the four of us can see and
 * in principle edit each other's picks, which is fine. The one rule the server
 * does enforce is the kickoff lock, because that's the rule that matters.
 */
export async function setPick(
  playerId: number,
  gameId: number,
  side: "home" | "away",
): Promise<ActionResult> {
  await ready();

  if (side !== "home" && side !== "away") return { ok: false, error: "Invalid pick" };

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return { ok: false, error: "Game not found" };

  if (Date.now() >= game.kickoff || game.status !== "pre") {
    return { ok: false, error: "This game has already kicked off" };
  }

  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return { ok: false, error: "Player not found" };

  const now = Date.now();
  const existing = await db.select().from(picks).where(eq(picks.gameId, gameId));
  const mine = existing.find((p) => p.playerId === playerId);

  if (mine) {
    if (mine.side === side) {
      // Tapping your current pick clears it.
      await db.delete(picks).where(eq(picks.id, mine.id));
    } else {
      await db
        .update(picks)
        .set({ side, spreadAtPick: game.spread, updatedAt: now })
        .where(eq(picks.id, mine.id));
    }
  } else {
    await db.insert(picks).values({
      playerId,
      gameId,
      side,
      spreadAtPick: game.spread,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath("/");
  return { ok: true };
}

/** Remember who's using this browser so the app opens on the right player. */
export async function selectPlayer(slug: string): Promise<void> {
  const jar = await cookies();
  jar.set("pickem_player", slug, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Replace a week's slate with an explicit set of games.
 *
 * Guarded hard against data loss: a game that anyone has already picked, or one
 * that has kicked off, cannot be removed. Everything chosen here is pinned so
 * the automatic picker stops second-guessing it.
 */
export async function setSlate(
  season: number,
  week: number,
  espnIds: string[],
): Promise<ActionResult> {
  await ready();

  const wanted = [...new Set(espnIds)];
  if (wanted.length === 0) return { ok: false, error: "Pick at least one game" };
  if (wanted.length > GAMES_PER_WEEK) {
    return { ok: false, error: `At most ${GAMES_PER_WEEK} games` };
  }

  const existing = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)));

  const known = new Set(existing.map((g) => g.espnId));
  const unknown = wanted.filter((id) => !known.has(id));
  if (unknown.length) {
    return { ok: false, error: "That game isn't in this week — refresh and try again" };
  }

  const keep = new Set(wanted);
  const dropping = existing.filter((g) => g.isSelected && !keep.has(g.espnId));

  if (dropping.length) {
    /**
     * Picks no longer block a swap. Dropping a game only clears its flag — the
     * picks stay in the table and simply stop counting, and putting the game
     * back restores them. A game that has kicked off is still off limits,
     * because rewriting a week that's already being played is a different and
     * much worse idea.
     */
    const now = Date.now();
    const blocked = dropping.filter((g) => now >= g.kickoff || g.status !== "pre");
    if (blocked.length) {
      return {
        ok: false,
        error: `Can't remove ${blocked
          .map((g) => `${g.awayAbbr} @ ${g.homeAbbr}`)
          .join(", ")} — already kicked off`,
      };
    }
  }

  // Nothing is deleted: dropping a game from the slate just clears its flag, so
  // it stays in the table feeding the league-wide stats.
  await db
    .update(games)
    .set({ isSelected: false, selectionRank: null })
    .where(and(eq(games.season, season), eq(games.week, week)));

  await db
    .update(games)
    .set({ isSelected: true, manualPin: true })
    .where(and(eq(games.season, season), inArray(games.espnId, wanted)));

  await setSlatePinned(season, week, true);

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

/** Drop back to the automatic slate, keeping anything already picked or started. */
export async function resetSlate(season: number, week: number): Promise<ActionResult> {
  await ready();
  await autoSelectWeek(season, week);
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

export async function refreshWeek(season: number, week: number): Promise<ActionResult> {
  try {
    await syncWeek(season, week, { allowReselect: false });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Refresh failed" };
  }
}
