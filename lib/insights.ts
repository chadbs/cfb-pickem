import { asc, eq } from "drizzle-orm";
import { db, ready, schema } from "./db";
import { coveringSide, gradePick, spreadForPick, type PickResult, type Side } from "./scoring";
import { spreadForSide } from "./format";
import { getConferences } from "./sync";
import type { PlayerView } from "./view-types";

const { games, picks, players } = schema;

/**
 * Every FBS game is stored now, not just our ten, so a team's ATS record is a
 * real season-long sample. Four is the same floor the old app used.
 */
export const MIN_TEAM_GAMES = 4;

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

/** A conference's straight-up record against every other conference. */
export interface ConferenceRec {
  id: string;
  name: string;
  wins: number;
  losses: number;
}

export interface ConferenceMatchup {
  a: string;
  b: string;
  aWins: number;
  bWins: number;
}

export interface Insights {
  season: number;
  /** Completed FBS games in the database. */
  gradedGames: number;
  /** Completed games that were on our slate. */
  gradedSlateGames: number;
  splits: PlayerSplits[];
  h2h: HeadToHead[];
  teams: TeamAts[];
  conferences: ConferenceRec[];
  conferenceMatchups: ConferenceMatchup[];
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
  const confNames = await getConferences(season);

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

  // ---- league-wide: every team's record against the number ---------------
  const teamMap = new Map<string, TeamAts>();
  for (const g of gameRows) {
    if (!g.completed) continue;
    // Needs a line we actually captured; games that never had one are left out
    // rather than counted as pick'ems.
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

  // Without a floor this is just every team that happened to cover once, all
  // sitting at 100%.
  const teams = [...teamMap.values()]
    .filter((t) => total(t.rec) >= MIN_TEAM_GAMES)
    .sort((a, b) => pct(b.rec) - pct(a.rec) || total(b.rec) - total(a.rec))
    .slice(0, 12);

  // ---- conference strength, from non-conference games only ---------------
  // A conference's record against itself is 0.500 by construction, so only
  // cross-conference games say anything.
  const confRec = new Map<string, ConferenceRec>();
  const matchups = new Map<string, ConferenceMatchup>();

  for (const g of gameRows) {
    if (!g.completed || g.homeScore === null || g.awayScore === null) continue;
    if (g.homeScore === g.awayScore) continue;
    const hc = g.homeConfId;
    const ac = g.awayConfId;
    if (!hc || !ac || hc === ac) continue;
    if (!confNames[hc] || !confNames[ac]) continue; // skip FCS and unknowns

    const homeWon = g.homeScore > g.awayScore;
    const winner = homeWon ? hc : ac;
    const loser = homeWon ? ac : hc;

    for (const [id, isWin] of [
      [winner, true],
      [loser, false],
    ] as const) {
      const e = confRec.get(id) ?? { id, name: confNames[id], wins: 0, losses: 0 };
      if (isWin) e.wins++;
      else e.losses++;
      confRec.set(id, e);
    }

    const [x, y] = [hc, ac].sort();
    const key = `${x}:${y}`;
    const m = matchups.get(key) ?? { a: confNames[x], b: confNames[y], aWins: 0, bWins: 0 };
    if (winner === x) m.aWins++;
    else m.bWins++;
    matchups.set(key, m);
  }

  const conferences = [...confRec.values()].sort(
    (a, b) =>
      b.wins / Math.max(1, b.wins + b.losses) - a.wins / Math.max(1, a.wins + a.losses) ||
      b.wins - a.wins,
  );

  const conferenceMatchups = [...matchups.values()]
    .sort((a, b) => b.aWins + b.bWins - (a.aWins + a.bWins))
    .slice(0, 10);

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
    gradedSlateGames: gameRows.filter((g) => g.completed && g.isSelected).length,
    splits: [...splits.values()].sort((a, b) => pct(b.overall) - pct(a.overall)),
    h2h,
    teams,
    conferences,
    conferenceMatchups,
    consensus,
  };
}
