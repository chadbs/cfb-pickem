import { asc, eq } from "drizzle-orm";
import { db, ready, schema } from "./db";
import { coveringSide, gradePick, spreadForPick, type PickResult, type Side } from "./scoring";
import { spreadForSide } from "./format";
import type { PlayerView } from "./view-types";

const { games, picks, players } = schema;

/** A team needs this many games on our slate before its ATS record means anything. */
export const MIN_TEAM_GAMES = 3;

export interface Rec {
  wins: number;
  losses: number;
  pushes: number;
}

const empty = (): Rec => ({ wins: 0, losses: 0, pushes: 0 });

function add(r: Rec, result: PickResult) {
  if (result === "win") r.wins++;
  else if (result === "loss") r.losses++;
  else r.pushes++;
}

export function pct(r: Rec): number {
  const decided = r.wins + r.losses + r.pushes;
  return decided ? (r.wins + r.pushes * 0.5) / decided : 0;
}

export function total(r: Rec): number {
  return r.wins + r.losses + r.pushes;
}

export interface PlayerSplits {
  player: PlayerView;
  overall: Rec;
  favorites: Rec;
  underdogs: Rec;
  home: Rec;
  away: Rec;
  /** Games where nobody else took the same side. */
  alone: Rec;
  bestWeek: { week: number; rec: Rec } | null;
  worstWeek: { week: number; rec: Rec } | null;
}

export interface HeadToHead {
  a: PlayerView;
  b: PlayerView;
  aWins: number;
  bWins: number;
  /** Decided games where the two took opposite sides. */
  games: number;
}

export interface TeamAts {
  teamId: string;
  abbr: string;
  name: string;
  logo: string | null;
  rec: Rec;
}

export interface Insights {
  season: number;
  gradedGames: number;
  splits: PlayerSplits[];
  h2h: HeadToHead[];
  teams: TeamAts[];
  /** All four took the same side, and how those turned out. */
  consensus: Rec;
}

/**
 * Everything here is derived from our own slate — the ten games we pick each
 * week — so team records are a small sample by design, not a league-wide table.
 */
export async function getInsights(season: number): Promise<Insights> {
  await ready();

  const roster = await db.select().from(players).orderBy(asc(players.sort), asc(players.id));
  const gameRows = await db.select().from(games).where(eq(games.season, season));
  const pickRows = await db.select().from(picks);

  const gameById = new Map(gameRows.map((g) => [g.id, g]));
  const toView = (p: (typeof roster)[number]): PlayerView => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    accent: p.accent,
    initials: p.initials,
  });

  const mine = pickRows.filter((p) => gameById.has(p.gameId));

  // Who else is on each side of each game — needed for the "alone" split.
  const sideCount = new Map<string, number>();
  for (const p of mine) sideCount.set(`${p.gameId}:${p.side}`, (sideCount.get(`${p.gameId}:${p.side}`) ?? 0) + 1);

  const splits = new Map<number, PlayerSplits>();
  const weekRecs = new Map<number, Map<number, Rec>>();
  for (const p of roster) {
    splits.set(p.id, {
      player: toView(p),
      overall: empty(),
      favorites: empty(),
      underdogs: empty(),
      home: empty(),
      away: empty(),
      alone: empty(),
      bestWeek: null,
      worstWeek: null,
    });
    weekRecs.set(p.id, new Map());
  }

  let gradedGames = 0;
  for (const g of gameRows) if (g.completed) gradedGames++;

  for (const p of mine) {
    const g = gameById.get(p.gameId)!;
    const side = p.side as Side;
    const line = spreadForPick(g, p.spreadAtPick);
    const result = gradePick(g, side, line);
    if (!result) continue;

    const s = splits.get(p.playerId);
    if (!s) continue;

    add(s.overall, result);
    add(side === "home" ? s.home : s.away, result);

    const theirs = spreadForSide(line, side);
    if (theirs !== null && theirs !== 0) add(theirs < 0 ? s.favorites : s.underdogs, result);

    if ((sideCount.get(`${p.gameId}:${side}`) ?? 0) === 1) add(s.alone, result);

    const wk = weekRecs.get(p.playerId)!;
    const rec = wk.get(g.week) ?? empty();
    add(rec, result);
    wk.set(g.week, rec);
  }

  for (const [playerId, wk] of weekRecs) {
    const s = splits.get(playerId)!;
    const entries = [...wk.entries()].filter(([, r]) => total(r) > 0);
    if (!entries.length) continue;
    const sorted = entries.sort(
      (a, b) => pct(b[1]) - pct(a[1]) || b[1].wins - a[1].wins,
    );
    s.bestWeek = { week: sorted[0][0], rec: sorted[0][1] };
    const last = sorted[sorted.length - 1];
    if (sorted.length > 1) s.worstWeek = { week: last[0], rec: last[1] };
  }

  // ---- head to head, on games where two players actually disagreed ---------
  const h2h: HeadToHead[] = [];
  const byGame = new Map<number, typeof mine>();
  for (const p of mine) {
    const list = byGame.get(p.gameId) ?? [];
    list.push(p);
    byGame.set(p.gameId, list);
  }

  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      const a = roster[i];
      const b = roster[j];
      let aWins = 0;
      let bWins = 0;
      let n = 0;
      for (const [gameId, list] of byGame) {
        const pa = list.find((p) => p.playerId === a.id);
        const pb = list.find((p) => p.playerId === b.id);
        if (!pa || !pb || pa.side === pb.side) continue;
        const g = gameById.get(gameId)!;
        const ra = gradePick(g, pa.side as Side, spreadForPick(g, pa.spreadAtPick));
        const rb = gradePick(g, pb.side as Side, spreadForPick(g, pb.spreadAtPick));
        if (!ra || !rb) continue;
        if (ra === "win" && rb !== "win") {
          aWins++;
          n++;
        } else if (rb === "win" && ra !== "win") {
          bWins++;
          n++;
        }
      }
      h2h.push({ a: toView(a), b: toView(b), aWins, bWins, games: n });
    }
  }

  // ---- how the teams in our slate have done against the number ------------
  const teamMap = new Map<string, TeamAts>();
  for (const g of gameRows) {
    if (!g.completed) continue;
    const cover = coveringSide(g);
    if (cover === null) continue;
    for (const side of ["home", "away"] as const) {
      const teamId = side === "home" ? g.homeTeamId : g.awayTeamId;
      const entry =
        teamMap.get(teamId) ??
        ({
          teamId,
          abbr: side === "home" ? g.homeAbbr : g.awayAbbr,
          name: side === "home" ? g.homeName : g.awayName,
          logo: side === "home" ? g.homeLogo : g.awayLogo,
          rec: empty(),
        } satisfies TeamAts);
      add(entry.rec, cover === "push" ? "push" : cover === side ? "win" : "loss");
      teamMap.set(teamId, entry);
    }
  }

  // Without a floor this list is just every team that happened to cover once,
  // all sitting at 100%. In practice the teams that clear it are the four we
  // pick every week, which is the interesting cut anyway.
  const teams = [...teamMap.values()]
    .filter((t) => total(t.rec) >= MIN_TEAM_GAMES)
    .sort((a, b) => pct(b.rec) - pct(a.rec) || total(b.rec) - total(a.rec))
    .slice(0, 12);

  // ---- when everyone agreed ----------------------------------------------
  const consensus = empty();
  for (const [gameId, list] of byGame) {
    if (list.length !== roster.length || roster.length === 0) continue;
    const side = list[0].side;
    if (!list.every((p) => p.side === side)) continue;
    const g = gameById.get(gameId)!;
    const r = gradePick(g, side as Side, spreadForPick(g, list[0].spreadAtPick));
    if (r) add(consensus, r);
  }

  return {
    season,
    gradedGames,
    splits: [...splits.values()].sort((a, b) => pct(b.overall) - pct(a.overall)),
    h2h,
    teams,
    consensus,
  };
}
