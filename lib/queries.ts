import { and, asc, eq, inArray } from "drizzle-orm";
import { db, ready, schema } from "./db";
import {
  buildLeaderboard,
  coverMargin,
  coveringSide,
  effectiveSpread,
  gradePick,
  pointsForPick,
  type PickResult,
  type Side,
} from "./scoring";
import type { GamePick, GameView, PlayerView, StandingView } from "./view-types";
import type { Game, Player } from "./db/schema";

const { games, picks, players } = schema;

function toPlayerView(p: Player): PlayerView {
  return { id: p.id, slug: p.slug, name: p.name, accent: p.accent, initials: p.initials };
}

export async function getPlayers(): Promise<PlayerView[]> {
  await ready();
  const rows = await db.select().from(players).orderBy(asc(players.sort), asc(players.id));
  return rows.map(toPlayerView);
}

function toGameView(g: Game, gamePicks: GamePick[], now: number): GameView {
  // ESPN reports 0-0 for games that haven't started; don't show that as a score.
  const started = g.status !== "pre";
  return {
    id: g.id,
    season: g.season,
    week: g.week,
    kickoff: g.kickoff,
    home: {
      teamId: g.homeTeamId,
      name: g.homeName,
      short: g.homeShort,
      abbr: g.homeAbbr,
      logo: g.homeLogo,
      color: g.homeColor,
      rank: g.homeRank,
      record: g.homeRecord,
      score: started ? g.homeScore : null,
    },
    away: {
      teamId: g.awayTeamId,
      name: g.awayName,
      short: g.awayShort,
      abbr: g.awayAbbr,
      logo: g.awayLogo,
      color: g.awayColor,
      rank: g.awayRank,
      record: g.awayRecord,
      score: started ? g.awayScore : null,
    },
    neutralSite: g.neutralSite,
    venue: g.venue,
    broadcast: g.broadcast,
    spread: g.spread,
    lockedSpread: g.lockedSpread,
    gradingSpread: effectiveSpread(g),
    overUnder: g.overUnder,
    status: g.status as "pre" | "in" | "post",
    statusDetail: g.statusDetail,
    period: g.period,
    clock: g.clock,
    completed: g.completed,
    locked: now >= g.kickoff || g.status !== "pre",
    covering: coveringSide(g),
    selectionReason: g.selectionReason,
    picks: gamePicks,
  };
}

export async function getBoard(season: number, week: number): Promise<GameView[]> {
  await ready();

  // The table holds every FBS game now, so the board must ask for the slate.
  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week), eq(games.isSelected, true)))
    .orderBy(asc(games.kickoff), asc(games.id));

  if (rows.length === 0) return [];

  const ids = new Set(rows.map((g) => g.id));
  const allPicks = (await db.select().from(picks)).filter((p) => ids.has(p.gameId));

  const byGame = new Map<number, GamePick[]>();
  for (const p of allPicks) {
    const game = rows.find((g) => g.id === p.gameId)!;
    const side = p.side as Side;
    const list = byGame.get(p.gameId) ?? [];
    list.push({
      playerId: p.playerId,
      side,
      result: gradePick(game, side),
      liveCovering: game.status === "in" && (coverMargin(game, side) ?? 0) > 0,
      auto: p.auto,
      isLock: p.isLock,
    });
    byGame.set(p.gameId, list);
  }

  const now = Date.now();
  return rows.map((g) => toGameView(g, byGame.get(g.id) ?? [], now));
}

export interface WeeklyLine {
  week: number;
  byPlayer: Record<
    number,
    {
      wins: number;
      losses: number;
      pushes: number;
      points: number;
      /** How their lock went that week, null if they never set one. */
      lock: PickResult | null;
    }
  >;
}

export interface SeasonStandings {
  roster: PlayerView[];
  standings: StandingView[];
  weekly: WeeklyLine[];
}

export async function getSeasonStandings(season: number): Promise<SeasonStandings> {
  await ready();

  const roster = await db.select().from(players).orderBy(asc(players.sort), asc(players.id));
  const rows = await db
    .select({
      playerId: picks.playerId,
      side: picks.side,
      week: games.week,
      kickoff: games.kickoff,
      completed: games.completed,
      homeScore: games.homeScore,
      awayScore: games.awayScore,
      lockedSpread: games.lockedSpread,
      spread: games.spread,
      manualSpread: games.manualSpread,
      isLock: picks.isLock,
    })
    .from(picks)
    .innerJoin(games, eq(picks.gameId, games.id))
    // Only games currently on a slate. A pick on a game an admin later dropped
    // is kept but must not score, or it would count somewhere it isn't shown.
    .where(and(eq(games.season, season), eq(games.isSelected, true)));

  const graded = rows.map((r) => ({
    playerId: r.playerId,
    week: r.week,
    kickoff: r.kickoff,
    // Settled at the game's closing line — same rule as the board.
    result: gradePick(r, r.side as Side),
    isLock: r.isLock,
  }));

  const standings: StandingView[] = buildLeaderboard(roster, graded).map((s) => ({
    ...s,
    player: toPlayerView(s.player),
  }));

  // Only weeks with something decided. A week where everyone's picks are still
  // pending would otherwise render as a row of meaningless 0-0s.
  const weeks = [...new Set(graded.filter((g) => g.result !== null).map((g) => g.week))].sort(
    (a, b) => a - b,
  );
  const weekly: WeeklyLine[] = weeks.map((week) => {
    const byPlayer: WeeklyLine["byPlayer"] = {};
    for (const g of graded) {
      if (g.week !== week) continue;
      const cur = (byPlayer[g.playerId] ??= {
        wins: 0,
        losses: 0,
        pushes: 0,
        points: 0,
        lock: null,
      });
      if (g.result === "win") cur.wins++;
      else if (g.result === "loss") cur.losses++;
      else if (g.result === "push") cur.pushes++;
      if (!g.result) continue;
      cur.points += pointsForPick(g.result, g.isLock);
      if (g.isLock) cur.lock = g.result;
    }
    return { week, byPlayer };
  });

  return { roster: roster.map(toPlayerView), standings, weekly };
}

export async function getPlayerBySlug(slug: string): Promise<PlayerView | null> {
  await ready();
  const [row] = await db.select().from(players).where(eq(players.slug, slug)).limit(1);
  return row ? toPlayerView(row) : null;
}

/** How many of this player's picks this week were filled in for them. */
export async function countAutoPicks(
  season: number,
  week: number,
  playerId: number,
): Promise<number> {
  await ready();
  const rows = await db
    .select({ id: picks.id })
    .from(picks)
    .innerJoin(games, eq(picks.gameId, games.id))
    .where(
      and(
        eq(picks.playerId, playerId),
        eq(picks.auto, true),
        eq(games.season, season),
        eq(games.week, week),
        eq(games.isSelected, true),
      ),
    );
  return rows.length;
}

export interface SlateChange {
  /** This player's picks on games that are no longer on the slate. */
  dropped: string[];
  /** Slate games they haven't picked and still can. */
  needsPick: number;
}

/**
 * Whether the slate moved under a player after they'd picked.
 *
 * A pick on a game that has since been swapped out stops counting, silently —
 * the game simply isn't on the board any more. Only a dropped pick proves the
 * slate changed; someone who merely hasn't finished picking has no dropped
 * ones, and the progress meter already covers that case.
 *
 * Callers should require needsPick > 0 before saying anything. The dropped pick
 * is kept indefinitely, so it is not on its own a reason to keep nagging once
 * the replacement has been picked.
 */
export async function getSlateChange(
  season: number,
  week: number,
  playerId: number,
): Promise<SlateChange> {
  await ready();

  const weekGames = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)));
  if (weekGames.length === 0) return { dropped: [], needsPick: 0 };

  const mine = await db
    .select()
    .from(picks)
    .where(
      and(
        eq(picks.playerId, playerId),
        inArray(picks.gameId, weekGames.map((g) => g.id)),
      ),
    );

  const byId = new Map(weekGames.map((g) => [g.id, g]));
  const dropped = mine
    .map((p) => byId.get(p.gameId))
    .filter((g): g is NonNullable<typeof g> => Boolean(g) && !g!.isSelected)
    .map((g) => `${g.awayAbbr} @ ${g.homeAbbr}`);

  const picked = new Set(mine.map((p) => p.gameId));
  const now = Date.now();
  const needsPick = weekGames.filter(
    (g) => g.isSelected && !picked.has(g.id) && now < g.kickoff && g.status === "pre",
  ).length;

  return { dropped, needsPick };
}

export interface TeamRecord {
  teamId: string;
  name: string;
  abbr: string;
  logo: string | null;
  wins: number;
  losses: number;
  /** Completed games we hold for this team. */
  played: number;
}

/**
 * A team's record so far, counted from the completed games in our own table.
 *
 * Every game involving an FBS team shows up in the FBS scoreboard, so this
 * covers their whole schedule — including FCS opponents — provided each week
 * has been synced. Ties don't exist in college football, so wins + losses is
 * the whole story.
 */
export async function getTeamRecords(
  season: number,
  teamIds: string[],
): Promise<TeamRecord[]> {
  await ready();
  if (teamIds.length === 0) return [];

  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.completed, true)))
    .orderBy(asc(games.kickoff));

  const wanted = new Set(teamIds);
  const acc = new Map<string, TeamRecord>();

  const seed = (id: string, name: string, abbr: string, logo: string | null) =>
    acc.get(id) ??
    acc.set(id, { teamId: id, name, abbr, logo, wins: 0, losses: 0, played: 0 }).get(id)!;

  for (const g of rows) {
    if (g.homeScore === null || g.awayScore === null) continue;
    const homeWon = g.homeScore > g.awayScore;

    if (wanted.has(g.homeTeamId)) {
      const t = seed(g.homeTeamId, g.homeShort, g.homeAbbr, g.homeLogo);
      t.played++;
      if (homeWon) t.wins++;
      else t.losses++;
    }
    if (wanted.has(g.awayTeamId)) {
      const t = seed(g.awayTeamId, g.awayShort, g.awayAbbr, g.awayLogo);
      t.played++;
      if (homeWon) t.losses++;
      else t.wins++;
    }
  }

  // Keep the caller's order, and include teams that haven't played yet.
  return teamIds.map(
    (id) =>
      acc.get(id) ?? {
        teamId: id,
        name: "",
        abbr: "",
        logo: null,
        wins: 0,
        losses: 0,
        played: 0,
      },
  );
}
