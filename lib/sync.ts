import { and, eq, inArray, sql } from "drizzle-orm";
import type { InArgs, InStatement } from "@libsql/client";
import { client, db, ready, schema } from "./db";
import {
  fetchConferences,
  fetchCurrentWeek,
  fetchWeek,
  type CurrentWeek,
  type EspnGame,
} from "./espn";
import { rankGames, type ScoredGame } from "./selection";
import { GAMES_PER_WEEK, SYNC_TTL_IDLE_MS, SYNC_TTL_LIVE_MS } from "./config";

const { games, picks, meta } = schema;

/** Re-picking the slate is allowed only this far ahead of the first kickoff. */
const RESELECT_WINDOW_MS = 48 * 60 * 60 * 1000;
const CURRENT_WEEK_TTL_MS = 30 * 60 * 1000;
const CONFERENCES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** libsql caps how much one batch can carry; well under it. */
const BATCH_SIZE = 80;

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

/** A hand-edited slate stops the auto-picker revising that week. */
const pinKey = (season: number, week: number) => `slate_pinned:${season}:${week}`;

export async function isSlatePinned(season: number, week: number): Promise<boolean> {
  return (await getMeta(pinKey(season, week)))?.value === "1";
}

export async function setSlatePinned(season: number, week: number, pinned: boolean) {
  await setMeta(pinKey(season, week), pinned ? "1" : "0");
}

/**
 * Which week is live right now, plus the full week list for the season nav.
 * Cached in the DB so a page load doesn't pay for an ESPN round trip.
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

/** Conference id → short name, cached for a week. */
export async function getConferences(season: number): Promise<Record<string, string>> {
  const cached = await getMeta("conferences");
  if (cached && Date.now() - cached.updatedAt < CONFERENCES_TTL_MS) {
    try {
      return JSON.parse(cached.value) as Record<string, string>;
    } catch {
      /* refetch */
    }
  }
  try {
    const fresh = await fetchConferences(season);
    if (Object.keys(fresh).length) await setMeta("conferences", JSON.stringify(fresh));
    return fresh;
  } catch {
    return cached ? (JSON.parse(cached.value) as Record<string, string>) : {};
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
    homeConfId: g.home.conferenceId,
    awayTeamId: g.away.teamId,
    awayName: g.away.name,
    awayShort: g.away.short,
    awayAbbr: g.away.abbr,
    awayLogo: g.away.logo,
    awayColor: g.away.color,
    awayRank: g.away.rank,
    awayRecord: g.away.record,
    awayScore: g.away.score,
    awayConfId: g.away.conferenceId,
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

async function runBatch(statements: InStatement[]) {
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await client.batch(statements.slice(i, i + BATCH_SIZE), "write");
  }
}

export interface SyncResult {
  season: number;
  week: number;
  /** Every FBS game stored for the week, not just the slate. */
  stored: number;
  selected: number;
  locked: number;
  reselected: boolean;
}

/**
 * Mark exactly these games as the week's slate. Nothing is deleted — a game
 * that drops off the slate stays in the table, which is what makes league-wide
 * stats possible and means a pick can never be orphaned by a slate change.
 */
async function applySelection(season: number, week: number, chosen: ScoredGame[]) {
  const clear = db
    .update(games)
    .set({ isSelected: false, selectionRank: null })
    .where(and(eq(games.season, season), eq(games.week, week)))
    .toSQL();

  const sets = chosen.map((c, i) =>
    db
      .update(games)
      .set({
        isSelected: true,
        selectionRank: i + 1,
        selectionScore: c.score,
        selectionReason: c.reason,
      })
      .where(eq(games.espnId, c.game.espnId))
      .toSQL(),
  );

  await runBatch(
    [clear, ...sets].map((s) => ({ sql: s.sql, args: s.params as InArgs })),
  );
}

/**
 * Choose a slate automatically, keeping `forced` games in regardless of rank —
 * that's how already-picked games survive a reset.
 */
function autoSelect(espnGames: EspnGame[], forced: Set<string>): ScoredGame[] {
  const ranked = rankGames(espnGames);
  const keep = ranked.filter((r) => forced.has(r.game.espnId));
  const rest = ranked.filter((r) => !forced.has(r.game.espnId));
  return [...keep, ...rest.slice(0, Math.max(0, GAMES_PER_WEEK - keep.length))].sort(
    (a, b) => a.game.kickoff - b.game.kickoff,
  );
}

/**
 * Pull the week from ESPN, store every game in it, keep scores and lines
 * current, and freeze each game's closing line at kickoff.
 */
export async function syncWeek(
  season: number,
  week: number,
  opts: { allowReselect?: boolean } = {},
): Promise<SyncResult> {
  await ready();
  const allowReselect = opts.allowReselect ?? true;

  const espnGames = await fetchWeek(season, week);
  if (espnGames.length === 0) {
    return { season, week, stored: 0, selected: 0, locked: 0, reselected: false };
  }

  const existing = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)));
  const byEspnId = new Map(existing.map((g) => [g.espnId, g]));
  const now = Date.now();

  // ---- store every game in the week -------------------------------------
  let locked = 0;
  const upserts = espnGames.map((g) => {
    const row = byEspnId.get(g.espnId);

    // Don't let a null from ESPN wipe a line we already captured.
    const spread = g.spread ?? row?.spread ?? null;

    /**
     * Freeze the closing line at kickoff. ESPN drops odds the moment a game
     * goes final, so this is the only chance to keep the number.
     *
     * Slate games fall back to a pick'em when no line was ever posted, so a
     * pick always grades. Everything else stays null and is simply left out of
     * the league-wide ATS stats rather than being recorded as a phantom PK.
     */
    let lockedSpread = row?.lockedSpread ?? null;
    if (lockedSpread === null && (now >= g.kickoff || g.status !== "pre")) {
      lockedSpread = spread ?? (row?.isSelected ? 0 : null);
      if (lockedSpread !== null) locked++;
    }

    const values = { ...rowFromEspn(g), spread, lockedSpread };
    // `values` deliberately carries no selection columns, so an update here
    // can never clobber the slate.
    const q = db
      .insert(games)
      .values(values)
      .onConflictDoUpdate({ target: games.espnId, set: values })
      .toSQL();
    return { sql: q.sql, args: q.params as InArgs };
  });

  await runBatch(upserts);

  // ---- decide the slate --------------------------------------------------
  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)));
  const selected = rows.filter((r) => r.isSelected);
  const pinned = await isSlatePinned(season, week);

  let reselected = false;

  if (selected.length === 0) {
    await applySelection(season, week, autoSelect(espnGames, new Set()));
    reselected = true;
  } else if (allowReselect && !pinned) {
    // Early in the week the books haven't posted lines, so the first slate is
    // picked half-blind. Let it improve — but only while nobody has picked and
    // the first kickoff is still comfortably away.
    const pickedIds = new Set(
      (
        await db
          .select({ gameId: picks.gameId })
          .from(picks)
          .where(inArray(picks.gameId, selected.map((g) => g.id)))
      ).map((r) => r.gameId),
    );
    const earliest = Math.min(...selected.map((g) => g.kickoff));
    const anyStarted = selected.some((g) => g.status !== "pre" || now >= g.kickoff);
    const frozen = pickedIds.size > 0 || anyStarted || earliest - now < RESELECT_WINDOW_MS;

    if (!frozen) {
      await applySelection(season, week, autoSelect(espnGames, new Set()));
      reselected = true;
    }
  }

  await setMeta(`sync:${season}:${week}`, String(now));

  const selectedCount = reselected
    ? Math.min(GAMES_PER_WEEK, espnGames.length)
    : selected.length;

  return { season, week, stored: espnGames.length, selected: selectedCount, locked, reselected };
}

/** Re-run the automatic slate, keeping anything already picked. */
export async function autoSelectWeek(season: number, week: number): Promise<void> {
  await ready();
  const espnGames = await fetchWeek(season, week);
  if (!espnGames.length) return;

  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)));

  const pickedGameIds = new Set(
    (
      await db
        .select({ gameId: picks.gameId })
        .from(picks)
        .where(inArray(picks.gameId, rows.length ? rows.map((g) => g.id) : [-1]))
    ).map((r) => r.gameId),
  );
  const now = Date.now();
  const forced = new Set(
    rows
      .filter((g) => pickedGameIds.has(g.id) || (g.isSelected && now >= g.kickoff))
      .map((g) => g.espnId),
  );

  await applySelection(season, week, autoSelect(espnGames, forced));
  await setSlatePinned(season, week, false);
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
    // Only the slate drives the refresh rate — a live game nobody picked isn't
    // worth hammering ESPN for.
    const hotRow = await db
      .select({ n: sql<number>`count(*)` })
      .from(games)
      .where(
        and(
          eq(games.season, season),
          eq(games.week, week),
          eq(games.isSelected, true),
          eq(games.completed, false),
          sql`${games.kickoff} <= ${Date.now()}`,
        ),
      )
      .get();

    const hot = (hotRow?.n ?? 0) > 0;
    if (age < (hot ? SYNC_TTL_LIVE_MS : SYNC_TTL_IDLE_MS)) return null;
  }

  try {
    return await syncWeek(season, week);
  } catch (err) {
    console.error("[sync] failed", season, week, err);
    return null;
  }
}
