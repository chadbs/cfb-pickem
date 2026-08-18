import { and, asc, eq } from "drizzle-orm";
import { db, ready, schema } from "./db";
import {
  buildLeaderboard,
  coveringSide,
  effectiveSpread,
  gradePick,
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

  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)))
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
      liveCovering: game.status === "in" && coveringSide(game) === side,
    });
    byGame.set(p.gameId, list);
  }

  const now = Date.now();
  return rows.map((g) => toGameView(g, byGame.get(g.id) ?? [], now));
}

export interface WeeklyLine {
  week: number;
  byPlayer: Record<number, { wins: number; losses: number; pushes: number; points: number }>;
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
    })
    .from(picks)
    .innerJoin(games, eq(picks.gameId, games.id))
    .where(eq(games.season, season));

  const graded = rows.map((r) => ({
    playerId: r.playerId,
    week: r.week,
    kickoff: r.kickoff,
    result: gradePick(r, r.side as Side),
  }));

  const standings: StandingView[] = buildLeaderboard(roster, graded).map((s) => ({
    ...s,
    player: toPlayerView(s.player),
  }));

  const weeks = [...new Set(graded.map((g) => g.week))].sort((a, b) => a - b);
  const weekly: WeeklyLine[] = weeks.map((week) => {
    const byPlayer: WeeklyLine["byPlayer"] = {};
    for (const g of graded) {
      if (g.week !== week) continue;
      const cur = (byPlayer[g.playerId] ??= { wins: 0, losses: 0, pushes: 0, points: 0 });
      if (g.result === "win") {
        cur.wins++;
        cur.points += 1;
      } else if (g.result === "loss") cur.losses++;
      else if (g.result === "push") {
        cur.pushes++;
        cur.points += 0.5;
      }
    }
    return { week, byPlayer };
  });

  return { roster: roster.map(toPlayerView), standings, weekly };
}

export async function getPlayerBySlug(slug: string): Promise<PlayerView | null> {
  await ready();
  const row = await db.select().from(players).where(eq(players.slug, slug)).get();
  return row ? toPlayerView(row) : null;
}
