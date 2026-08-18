import { and, eq, inArray, sql } from "drizzle-orm";
import { db, ready, schema } from "./db";
import { fetchCurrentWeek, fetchWeek, type CurrentWeek, type EspnGame } from "./espn";
import { rankGames, selectWeek } from "./selection";
import { GAMES_PER_WEEK, SYNC_TTL_IDLE_MS, SYNC_TTL_LIVE_MS } from "./config";

const { games, picks, meta } = schema;

/** Re-picking the slate is allowed only this far ahead of the first kickoff. */
const RESELECT_WINDOW_MS = 48 * 60 * 60 * 1000;
const CURRENT_WEEK_TTL_MS = 30 * 60 * 1000;

export async function getMeta(key: string): Promise<{ value: string; updatedAt: number } | null> {
  await ready();
  const row = await db.select().from(meta).where(eq(meta.key, key)).get();
  return row ? { value: row.value, updatedAt: row.updatedAt } : null;
}

export async function setMeta(key: string, value: string) {
  await ready();
  await db
    .insert(meta)
    .values({ key, value, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: meta.key, set: { value, updatedAt: Date.now() } });
}

/**
 * Which week we're in. Cached in the DB so a page load doesn't pay for an ESPN
 * round trip just to render the week nav.
 */
export async function getCurrentWeek(): Promise<CurrentWeek> {
  const cached = await getMeta("current_week");
  if (cached && Date.now() - cached.updatedAt < CURRENT_WEEK_TTL_MS) {
    try {
      return JSON.parse(cached.value) as CurrentWeek;
    } catch {
      /* fall through and refetch */
    }
  }
  try {
    const fresh = await fetchCurrentWeek();
    await setMeta("current_week", JSON.stringify(fresh));
    return fresh;
  } catch (err) {
    // ESPN hiccup: stale data beats an error page.
    if (cached) return JSON.parse(cached.value) as CurrentWeek;
    throw err;
  }
}

export function rowFromEspn(g: EspnGame) {
  return {
    espnId: g.espnId,
    season: g.season,
    week: g.week,
    seasonType: g.seasonType,
    kickoff: g.kickoff,
    homeTeamId: g.home.teamId,
    homeName: g.home.name,
    homeShort: g.home.short,
    homeAbbr: g.home.abbr,
    homeLogo: g.home.logo,
    homeColor: g.home.color,
    homeRank: g.home.rank,
    homeRecord: g.home.record,
    homeScore: g.home.score,
    awayTeamId: g.away.teamId,
    awayName: g.away.name,
    awayShort: g.away.short,
    awayAbbr: g.away.abbr,
    awayLogo: g.away.logo,
    awayColor: g.away.color,
    awayRank: g.away.rank,
    awayRecord: g.away.record,
    awayScore: g.away.score,
    neutralSite: g.neutralSite,
    venue: g.venue,
    broadcast: g.broadcast,
    spread: g.spread,
    overUnder: g.overUnder,
    oddsProvider: g.oddsProvider,
    status: g.status,
    statusDetail: g.statusDetail,
    period: g.period,
    clock: g.clock,
    completed: g.completed,
    updatedAt: Date.now(),
  };
}

/**
 * Top the week up to GAMES_PER_WEEK with the best candidates not already on the
 * slate. Used after an admin reset, where deleting the auto-picked games leaves
 * a short week that needs refilling deterministically.
 */
export async function fillSlate(season: number, week: number): Promise<number> {
  await ready();

  const existing = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)));

  const room = GAMES_PER_WEEK - existing.length;
  if (room <= 0) return 0;

  const espnGames = await fetchWeek(season, week);
  const taken = new Set(existing.map((g) => g.espnId));
  const candidates = rankGames(espnGames.filter((g) => !taken.has(g.espnId))).slice(0, room);

  for (const c of candidates) {
    await db.insert(games).values({
      ...rowFromEspn(c.game),
      isSelected: true,
      selectionScore: c.score,
      selectionReason: c.reason,
    });
  }
  return candidates.length;
}

export interface SyncResult {
  season: number;
  week: number;
  selected: number;
  created: number;
  updated: number;
  locked: number;
  reselected: boolean;
}

/**
 * Pull the week from ESPN, keep the slate's scores/lines/status current, and
 * freeze each game's closing line at kickoff.
 */
export async function syncWeek(
  season: number,
  week: number,
  opts: { allowReselect?: boolean } = {},
): Promise<SyncResult> {
  await ready();
  const allowReselect = opts.allowReselect ?? true;

  const espnGames = await fetchWeek(season, week);
  const byEspnId = new Map(espnGames.map((g) => [g.espnId, g]));

  let existing = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)));

  let created = 0;
  let reselected = false;
  const now = Date.now();

  // ---- Slate construction -------------------------------------------------
  if (existing.length === 0 && espnGames.length > 0) {
    const chosen = selectWeek(espnGames, GAMES_PER_WEEK);
    for (const [i, s] of chosen.entries()) {
      await db.insert(games).values({
        ...rowFromEspn(s.game),
        isSelected: true,
        selectionRank: i + 1,
        selectionScore: s.score,
        selectionReason: s.reason,
      });
      created++;
    }
    reselected = true;
  } else if (allowReselect && espnGames.length > 0) {
    // Early in the week the lines aren't posted yet, so the first slate we build
    // is picked half-blind. Allow it to improve — but only while nobody has
    // picked and the first kickoff is still comfortably away. A pick freezes
    // the slate instantly; we never delete a game someone has picked.
    const pickedGameIds = new Set(
      (
        await db
          .select({ gameId: picks.gameId })
          .from(picks)
          .where(
            inArray(
              picks.gameId,
              existing.map((g) => g.id),
            ),
          )
      ).map((r) => r.gameId),
    );
    const earliest = Math.min(...existing.map((g) => g.kickoff));
    const anyStarted = existing.some((g) => g.status !== "pre" || now >= g.kickoff);
    const frozen = pickedGameIds.size > 0 || anyStarted || earliest - now < RESELECT_WINDOW_MS;

    if (!frozen) {
      const pinned = existing.filter((g) => g.manualPin);
      const pinnedIds = new Set(pinned.map((g) => g.espnId));
      const room = GAMES_PER_WEEK - pinned.length;
      const chosen = selectWeek(
        espnGames.filter((g) => !pinnedIds.has(g.espnId)),
        Math.max(0, room),
      );
      const keep = new Set([...pinnedIds, ...chosen.map((c) => c.game.espnId)]);

      const drop = existing.filter((g) => !keep.has(g.espnId)).map((g) => g.id);
      if (drop.length) await db.delete(games).where(inArray(games.id, drop));

      const have = new Set(existing.filter((g) => keep.has(g.espnId)).map((g) => g.espnId));
      for (const s of chosen) {
        if (have.has(s.game.espnId)) continue;
        await db.insert(games).values({
          ...rowFromEspn(s.game),
          isSelected: true,
          selectionScore: s.score,
          selectionReason: s.reason,
        });
        created++;
        reselected = true;
      }

      if (reselected || drop.length) {
        existing = await db
          .select()
          .from(games)
          .where(and(eq(games.season, season), eq(games.week, week)));
      }
    }
  }

  // ---- Refresh the slate --------------------------------------------------
  let updated = 0;
  let locked = 0;

  for (const row of existing) {
    const live = byEspnId.get(row.espnId);
    if (!live) continue;
    const next = rowFromEspn(live);

    // Freeze the closing line. ESPN drops odds entirely once a game ends, so if
    // we don't capture it here the number is gone for good and the week can't
    // be graded. Falling back to 0 treats a never-lined game as a pick'em.
    let lockedSpread = row.lockedSpread;
    if (lockedSpread === null && (now >= row.kickoff || live.status !== "pre")) {
      lockedSpread = live.spread ?? row.spread ?? 0;
      locked++;
    }

    // Don't let a null from ESPN wipe a line we already have.
    const spread = live.spread ?? row.spread;

    await db
      .update(games)
      .set({ ...next, spread, lockedSpread })
      .where(eq(games.id, row.id));
    updated++;
  }

  await setMeta(`sync:${season}:${week}`, String(now));

  const selected = existing.length || created;
  return { season, week, selected, created, updated, locked, reselected };
}

/**
 * Sync only if the data is stale. Live games refresh every ~25s; otherwise we
 * back off to 10 minutes so idle page loads stay cheap.
 */
export async function maybeSyncWeek(season: number, week: number): Promise<SyncResult | null> {
  await ready();

  const last = await getMeta(`sync:${season}:${week}`);
  const lastAt = last ? Number(last.value) : 0;
  const age = Date.now() - lastAt;

  if (lastAt) {
    const liveRow = await db
      .select({ n: sql<number>`count(*)` })
      .from(games)
      .where(and(eq(games.season, season), eq(games.week, week), eq(games.status, "in")))
      .get();

    // A game past kickoff but not yet marked live also warrants a fast refresh.
    const imminentRow = await db
      .select({ n: sql<number>`count(*)` })
      .from(games)
      .where(
        and(
          eq(games.season, season),
          eq(games.week, week),
          eq(games.completed, false),
          sql`${games.kickoff} <= ${Date.now()}`,
        ),
      )
      .get();

    const hot = (liveRow?.n ?? 0) > 0 || (imminentRow?.n ?? 0) > 0;
    if (age < (hot ? SYNC_TTL_LIVE_MS : SYNC_TTL_IDLE_MS)) return null;
  }

  try {
    return await syncWeek(season, week);
  } catch (err) {
    console.error("[sync] failed", season, week, err);
    return null;
  }
}
