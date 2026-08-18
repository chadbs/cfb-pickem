"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db, ready, schema } from "@/lib/db";
import { syncWeek } from "@/lib/sync";

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

export async function refreshWeek(season: number, week: number): Promise<ActionResult> {
  try {
    await syncWeek(season, week, { allowReselect: false });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Refresh failed" };
  }
}
