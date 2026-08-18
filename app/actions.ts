"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db, ready, schema } from "@/lib/db";
import { fillSlate, rowFromEspn, syncWeek } from "@/lib/sync";
import { fetchWeek } from "@/lib/espn";
import { scoreGame } from "@/lib/selection";
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

  const game = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) return { ok: false, error: "Game not found" };

  if (Date.now() >= game.kickoff || game.status !== "pre") {
    return { ok: false, error: "This game has already kicked off" };
  }

  const player = await db.select().from(players).where(eq(players.id, playerId)).get();
  if (!player) return { ok: false, error: "Player not found" };

  const now = Date.now();
  const existing = await db.select().from(picks).where(eq(picks.gameId, gameId)).all();
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

  const keep = new Set(wanted);
  const toDrop = existing.filter((g) => !keep.has(g.espnId));

  if (toDrop.length) {
    const pickedIds = new Set(
      (
        await db
          .select({ gameId: picks.gameId })
          .from(picks)
          .where(inArray(picks.gameId, toDrop.map((g) => g.id)))
      ).map((r) => r.gameId),
    );
    const now = Date.now();
    const blocked = toDrop.filter(
      (g) => pickedIds.has(g.id) || now >= g.kickoff || g.status !== "pre",
    );
    if (blocked.length) {
      return {
        ok: false,
        error: `Can't remove ${blocked
          .map((g) => `${g.awayAbbr} @ ${g.homeAbbr}`)
          .join(", ")} — already picked or kicked off`,
      };
    }
    await db.delete(games).where(inArray(games.id, toDrop.map((g) => g.id)));
  }

  const have = new Set(existing.filter((g) => keep.has(g.espnId)).map((g) => g.espnId));
  const missing = wanted.filter((id) => !have.has(id));

  if (missing.length) {
    const espnGames = await fetchWeek(season, week);
    const byId = new Map(espnGames.map((g) => [g.espnId, g]));
    for (const id of missing) {
      const live = byId.get(id);
      if (!live) return { ok: false, error: `Game ${id} is no longer on ESPN's schedule` };
      const scored = scoreGame(live);
      await db.insert(games).values({
        ...rowFromEspn(live),
        isSelected: true,
        selectionScore: scored.score,
        selectionReason: scored.reason,
        manualPin: true,
      });
    }
  }

  await db
    .update(games)
    .set({ manualPin: true })
    .where(and(eq(games.season, season), eq(games.week, week)));

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

/** Drop back to the automatic slate, keeping anything already picked or started. */
export async function resetSlate(season: number, week: number): Promise<ActionResult> {
  await ready();

  const existing = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)));

  if (existing.length) {
    const pickedIds = new Set(
      (
        await db
          .select({ gameId: picks.gameId })
          .from(picks)
          .where(inArray(picks.gameId, existing.map((g) => g.id)))
      ).map((r) => r.gameId),
    );
    const now = Date.now();
    const removable = existing.filter(
      (g) => !pickedIds.has(g.id) && now < g.kickoff && g.status === "pre",
    );
    if (removable.length) {
      await db.delete(games).where(inArray(games.id, removable.map((g) => g.id)));
    }
    await db
      .update(games)
      .set({ manualPin: false })
      .where(and(eq(games.season, season), eq(games.week, week)));
  }

  await fillSlate(season, week);

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
