"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db, ready, schema } from "@/lib/db";
import { autoSelectWeek, setSlatePinned, syncWeek } from "@/lib/sync";
import { BRACKET_SIZE, GAMES_PER_WEEK } from "@/lib/config";
import { effectiveSpread } from "@/lib/scoring";
import {
  choicesFor,
  completeWithChalk,
  isSlotId,
  pruneBracket,
  type SlotId,
  type Winners,
} from "@/lib/bracket";
import { detectField, getField, getPlayoff } from "@/lib/playoff";

const { bracketPicks, bracketTeams, games, picks, players } = schema;

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
        .set({ side, spreadAtPick: effectiveSpread(game), updatedAt: now })
        .where(eq(picks.id, mine.id));
    }
  } else {
    await db.insert(picks).values({
      playerId,
      gameId,
      side,
      spreadAtPick: effectiveSpread(game),
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath("/");
  return { ok: true };
}

/**
 * Set, move or clear this player's lock of the week.
 *
 * One lock a week, on a game they've already picked, and only while that game
 * hasn't kicked off. Calling it on the current lock clears it. A lock whose game
 * has started is committed — it can't be moved off, which is the whole point of
 * calling it in advance.
 */
export async function setLock(playerId: number, gameId: number): Promise<ActionResult> {
  await ready();

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return { ok: false, error: "Game not found" };
  if (Date.now() >= game.kickoff || game.status !== "pre") {
    return { ok: false, error: "This game has already kicked off" };
  }

  // The lock is a week-level claim, so the whole week has to be in hand.
  const weekGames = await db
    .select()
    .from(games)
    .where(and(eq(games.season, game.season), eq(games.week, game.week)));
  const byId = new Map(weekGames.map((g) => [g.id, g]));

  const mine = await db
    .select()
    .from(picks)
    .where(and(eq(picks.playerId, playerId), inArray(picks.gameId, weekGames.map((g) => g.id))));

  if (!mine.some((p) => p.gameId === gameId)) {
    return { ok: false, error: "Pick a side first, then lock it" };
  }

  const current = mine.find((p) => p.isLock);
  if (current && current.gameId !== gameId) {
    const locked = byId.get(current.gameId);
    const now = Date.now();
    if (locked && (now >= locked.kickoff || locked.status !== "pre")) {
      return {
        ok: false,
        error: `Your lock on ${locked.awayAbbr} @ ${locked.homeAbbr} has already kicked off`,
      };
    }
  }

  // Tapping the current lock clears it; anything else moves it here.
  const clearing = current?.gameId === gameId;

  await db.transaction(async (tx) => {
    const ids = mine.filter((p) => p.isLock).map((p) => p.id);
    if (ids.length) await tx.update(picks).set({ isLock: false }).where(inArray(picks.id, ids));
    if (!clearing) {
      await tx
        .update(picks)
        .set({ isLock: true })
        .where(and(eq(picks.gameId, gameId), eq(picks.playerId, playerId)));
    }
  });

  revalidatePath("/");
  revalidatePath("/standings");
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

/**
 * Set a game's line by hand, or pass null to go back to ESPN's.
 *
 * `spread` is home-relative like every other line in the app. Before kickoff it
 * only sets the override, and the sync freezes it as the closing line at
 * kickoff. After kickoff it rewrites the closing line directly — that's the
 * repair for a game that kicked off with no line and froze at a pick'em — and
 * every pick on the game regrades, since grading is computed, never stored.
 */
export async function setLine(gameId: number, spread: number | null): Promise<ActionResult> {
  await ready();

  if (spread !== null) {
    if (!Number.isFinite(spread) || Math.abs(spread) > 70) {
      return { ok: false, error: "That isn't a believable line" };
    }
    if (!Number.isInteger(spread * 2)) {
      return { ok: false, error: "Lines move in half points" };
    }
  }

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return { ok: false, error: "Game not found" };

  const started = Date.now() >= game.kickoff || game.status !== "pre";

  if (started) {
    // Clearing now would leave the closing line as whatever froze at kickoff,
    // which is exactly the thing being corrected. Make it explicit instead.
    if (spread === null) {
      return { ok: false, error: "Already kicked off — set a number instead of clearing it" };
    }
    await db
      .update(games)
      .set({ manualSpread: spread, lockedSpread: spread })
      .where(eq(games.id, gameId));
  } else {
    await db.update(games).set({ manualSpread: spread }).where(eq(games.id, gameId));
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/standings");
  revalidatePath("/insights");
  return { ok: true };
}

/* ------------------------------------------------------ playoff bracket */

/**
 * Set or correct the twelve-team playoff field.
 *
 * Allowed only until the first playoff game kicks off, after which the bracket
 * everyone filled out is the bracket that stands. A correction before then
 * prunes any pick it invalidates — swap two seeds and most of a bracket
 * survives, since picks are stored as teams rather than positions.
 */
export async function setBracketField(
  season: number,
  entries: Array<{ seed: number; teamId: string }>,
): Promise<ActionResult> {
  await ready();

  const seeds = entries.map((e) => e.seed);
  if (entries.length !== BRACKET_SIZE) {
    return { ok: false, error: `The field is ${BRACKET_SIZE} teams` };
  }
  if (new Set(seeds).size !== BRACKET_SIZE || seeds.some((s) => s < 1 || s > BRACKET_SIZE)) {
    return { ok: false, error: `Seeds must be 1 to ${BRACKET_SIZE}, one each` };
  }
  if (new Set(entries.map((e) => e.teamId)).size !== BRACKET_SIZE) {
    return { ok: false, error: "The same team can't hold two seeds" };
  }

  const view = await getPlayoff(season);
  if (view.locked) {
    return { ok: false, error: "The playoff has started — the field is fixed" };
  }

  // Team details come from the games table, which holds every FBS team.
  const wanted = new Set(entries.map((e) => e.teamId));
  const rows = await db.select().from(games).where(eq(games.season, season));
  const found = new Map<string, { name: string; short: string; abbr: string; logo: string | null; color: string | null }>();
  for (const g of rows) {
    for (const side of ["home", "away"] as const) {
      const id = side === "home" ? g.homeTeamId : g.awayTeamId;
      if (!wanted.has(id) || found.has(id)) continue;
      found.set(id, {
        name: side === "home" ? g.homeName : g.awayName,
        short: side === "home" ? g.homeShort : g.awayShort,
        abbr: side === "home" ? g.homeAbbr : g.awayAbbr,
        logo: side === "home" ? g.homeLogo : g.awayLogo,
        color: side === "home" ? g.homeColor : g.awayColor,
      });
    }
  }

  const missing = entries.filter((e) => !found.has(e.teamId));
  if (missing.length) {
    return { ok: false, error: "Some of those teams aren't in this season's games yet" };
  }

  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(bracketTeams).where(eq(bracketTeams.season, season));
    await tx.insert(bracketTeams).values(
      entries.map((e) => ({
        season,
        seed: e.seed,
        teamId: e.teamId,
        ...found.get(e.teamId)!,
        updatedAt: now,
      })),
    );
  });

  // Anything the new seeding makes impossible goes; the rest stands.
  await pruneStoredBrackets(season);

  revalidatePath("/bracket");
  revalidatePath("/admin");
  return { ok: true };
}

/** Drop stored picks that the current field no longer allows. */
async function pruneStoredBrackets(season: number): Promise<void> {
  const field = await getField(season);
  const rows = await db.select().from(bracketPicks).where(eq(bracketPicks.season, season));

  const byPlayer = new Map<number, typeof rows>();
  for (const r of rows) byPlayer.set(r.playerId, [...(byPlayer.get(r.playerId) ?? []), r]);

  for (const [, mine] of byPlayer) {
    const kept = pruneBracket(
      field,
      Object.fromEntries(mine.map((r) => [r.slot, r.teamId])) as Winners,
    );
    const drop = mine.filter((r) => kept[r.slot as SlotId] !== r.teamId).map((r) => r.id);
    if (drop.length) await db.delete(bracketPicks).where(inArray(bracketPicks.id, drop));
  }
}

/**
 * Advance a team in one bracket slot, or clear it by picking the team that's
 * already there.
 *
 * A pick has to be one of the two teams that reach that game in this player's
 * own bracket, and changing an earlier round drops the later picks it
 * contradicts — the same rule a paper bracket enforces by having nowhere to
 * write the name.
 */
export async function setBracketPick(
  playerId: number,
  season: number,
  slot: string,
  teamId: string,
): Promise<ActionResult> {
  await ready();

  if (!isSlotId(slot)) return { ok: false, error: "Unknown bracket game" };

  const view = await getPlayoff(season);
  if (view.field.length === 0) return { ok: false, error: "The field hasn't been set yet" };
  if (view.locked) return { ok: false, error: "The playoff has started — brackets are final" };

  const entry = view.entries.find((e) => e.player.id === playerId);
  if (!entry) return { ok: false, error: "Player not found" };

  const legal = choicesFor(view.field, entry.picks, slot).some((t) => t.teamId === teamId);
  if (!legal) return { ok: false, error: "That team isn't in this game" };

  const next: Winners = { ...entry.picks };
  // Tapping the team you already have winning takes them back out.
  if (next[slot] === teamId) delete next[slot];
  else next[slot] = teamId;

  const pruned = pruneBracket(view.field, next);
  const now = Date.now();

  await db.transaction(async (tx) => {
    await tx
      .delete(bracketPicks)
      .where(and(eq(bracketPicks.playerId, playerId), eq(bracketPicks.season, season)));

    const rows = Object.entries(pruned)
      .filter(([, team]) => Boolean(team))
      .map(([s, team]) => ({
        playerId,
        season,
        slot: s,
        teamId: team!,
        auto: false,
        createdAt: now,
        updatedAt: now,
      }));
    if (rows.length) await tx.insert(bracketPicks).values(rows);
  });

  revalidatePath("/bracket");
  return { ok: true };
}

/**
 * Read the field off ESPN's playoff games: it carries each team's bracket seed
 * as its rank. Returns a suggestion for the admin to confirm, not a saved
 * field.
 */
export async function detectBracketField(
  season: number,
): Promise<ActionResult & { field?: Array<{ seed: number; teamId: string; abbr: string }> }> {
  await ready();

  const found = await detectField(season);
  if (found.length === 0) {
    return {
      ok: false,
      error: "No playoff games found yet — sync the bowls first, or seed it by hand",
    };
  }
  if (found.length < BRACKET_SIZE) {
    return {
      ok: false,
      error: `Only found ${found.length} of ${BRACKET_SIZE} seeds — the later rounds may not be posted yet`,
      field: found.map((t) => ({ seed: t.seed, teamId: t.teamId, abbr: t.abbr })),
    };
  }
  return { ok: true, field: found.map((t) => ({ seed: t.seed, teamId: t.teamId, abbr: t.abbr })) };
}

/**
 * Fill in the rest of your own bracket with chalk, keeping what you've already
 * chosen. A starting point for someone who only has opinions about three games.
 */
export async function chalkMyBracket(playerId: number, season: number): Promise<ActionResult> {
  await ready();

  const view = await getPlayoff(season);
  if (view.field.length === 0) return { ok: false, error: "The field hasn't been set yet" };
  if (view.locked) return { ok: false, error: "The playoff has started — brackets are final" };

  const entry = view.entries.find((e) => e.player.id === playerId);
  if (!entry) return { ok: false, error: "Player not found" };

  const full = completeWithChalk(view.field, entry.picks);
  const now = Date.now();

  for (const [slot, teamId] of Object.entries(full)) {
    if (!teamId || entry.picks[slot as SlotId] === teamId) continue;
    await db
      .insert(bracketPicks)
      .values({ playerId, season, slot, teamId, auto: false, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [bracketPicks.playerId, bracketPicks.season, bracketPicks.slot],
        set: { teamId, auto: false, updatedAt: now },
      });
  }

  revalidatePath("/bracket");
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
