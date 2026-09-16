/**
 * The playoff bracket, joined up to real data: the seeded field, everyone's
 * picks, and the results read out of the stored postseason games.
 *
 * The bracket's shape and scoring live in [`bracket.ts`](bracket.ts) and know
 * nothing about the database. This file is the part that talks to both.
 */
import { and, asc, eq } from "drizzle-orm";
import { db, ready, schema } from "./db";
import {
  SLOTS,
  bracketFilled,
  completeWithChalk,
  pruneBracket,
  resolveBracket,
  scoreBracket,
  type BracketScore,
  type BracketTeam,
  type ResolvedSlot,
  type SlotId,
  type Winners,
} from "./bracket";
import { POSTSEASON_WEEK } from "./config";
import type { PlayerView } from "./view-types";
import type { Game } from "./db/schema";

const { bracketPicks, bracketTeams, games, players } = schema;

export interface SlotGame {
  kickoff: number;
  status: string;
  completed: boolean;
  notes: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: string;
  awayTeamId: string;
}

export interface BracketEntry {
  player: PlayerView;
  picks: Winners;
  /** Their own bracket resolved — who they have in each matchup. */
  resolved: ResolvedSlot[];
  filled: number;
  /** Chalk, filled in for them at the first kickoff. */
  auto: boolean;
  score: BracketScore;
}

export interface PlayoffView {
  season: number;
  /** Seeded 1-12, or empty when the field hasn't been set yet. */
  field: BracketTeam[];
  /** The real results so far. */
  results: Winners;
  resultsResolved: ResolvedSlot[];
  /** The stored game behind each matchup, once the teams are known. */
  slotGames: Partial<Record<SlotId, SlotGame>>;
  /** First playoff kickoff — brackets freeze then. */
  lockAt: number | null;
  locked: boolean;
  entries: BracketEntry[];
}

function toBracketTeam(r: typeof bracketTeams.$inferSelect): BracketTeam {
  return {
    seed: r.seed,
    teamId: r.teamId,
    name: r.name,
    short: r.short,
    abbr: r.abbr,
    logo: r.logo,
    color: r.color,
  };
}

/**
 * Whether a playoff field has been seeded at all, for deciding if the bracket
 * tab exists. Deliberately not per-season: one cheap row check, and the page
 * itself handles a season whose field isn't set.
 */
export async function hasBracket(): Promise<boolean> {
  await ready();
  const [row] = await db.select({ id: bracketTeams.id }).from(bracketTeams).limit(1);
  return Boolean(row);
}

/** The stored playoff field, seeded. Empty until an admin sets it. */
export async function getField(season: number): Promise<BracketTeam[]> {
  await ready();
  const rows = await db
    .select()
    .from(bracketTeams)
    .where(eq(bracketTeams.season, season))
    .orderBy(asc(bracketTeams.seed));
  return rows.map(toBracketTeam);
}

/**
 * Walk the bracket against the postseason games we've stored, filling in who
 * actually won each matchup.
 *
 * Games are matched on the pair of team ids rather than on ESPN's round labels:
 * two playoff teams meeting in the postseason *is* that bracket game, whatever
 * the headline calls it. Each round has to be resolved before the next one's
 * participants are known, which is why this is a walk and not a lookup.
 */
export function readResults(
  field: BracketTeam[],
  postseason: Game[],
): { results: Winners; slotGames: Partial<Record<SlotId, SlotGame>> } {
  const results: Winners = {};
  const slotGames: Partial<Record<SlotId, SlotGame>> = {};
  if (field.length === 0) return { results, slotGames };

  for (const def of SLOTS) {
    const here = resolveBracket(field, results).find((r) => r.def.id === def.id)!;
    if (!here.a || !here.b) break; // nothing beyond this is knowable yet

    const pair = new Set([here.a.teamId, here.b.teamId]);
    const game = postseason.find(
      (g) => pair.has(g.homeTeamId) && pair.has(g.awayTeamId) && g.homeTeamId !== g.awayTeamId,
    );
    if (!game) continue;

    slotGames[def.id] = {
      kickoff: game.kickoff,
      status: game.status,
      completed: game.completed,
      notes: game.notes,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
    };

    if (!game.completed || game.homeScore === null || game.awayScore === null) continue;
    // College football has no ties, so one side always has more points.
    results[def.id] = game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
  }

  return { results, slotGames };
}

/** Everything /bracket needs: the field, the results and every player's entry. */
export async function getPlayoff(season: number): Promise<PlayoffView> {
  await ready();

  const [field, roster, pickRows, postseason] = await Promise.all([
    getField(season),
    db.select().from(players).orderBy(asc(players.sort), asc(players.id)),
    db.select().from(bracketPicks).where(eq(bracketPicks.season, season)),
    db
      .select()
      .from(games)
      .where(and(eq(games.season, season), eq(games.week, POSTSEASON_WEEK))),
  ]);

  const { results, slotGames } = readResults(field, postseason);

  // The bracket closes when the first playoff game starts, so everyone is
  // committed before anything is known.
  const kickoffs = Object.values(slotGames).map((g) => g.kickoff);
  const lockAt = kickoffs.length ? Math.min(...kickoffs) : null;
  const locked = lockAt !== null && Date.now() >= lockAt;

  const entries: BracketEntry[] = roster.map((p) => {
    const mine = pickRows.filter((r) => r.playerId === p.id);
    const picks = pruneBracket(
      field,
      Object.fromEntries(mine.map((r) => [r.slot, r.teamId])) as Winners,
    );
    return {
      player: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        accent: p.accent,
        initials: p.initials,
      },
      picks,
      resolved: resolveBracket(field, picks),
      filled: bracketFilled(field, picks),
      auto: mine.length > 0 && mine.every((r) => r.auto),
      score: scoreBracket(field, picks, results),
    };
  });

  return {
    season,
    field,
    results,
    resultsResolved: resolveBracket(field, results),
    slotGames,
    lockAt,
    locked,
    entries,
  };
}

/**
 * Work out the field from the games themselves.
 *
 * ESPN labels playoff games in the scoreboard's notes and carries each team's
 * bracket seed as its rank, so a synced postseason is enough to seed all twelve
 * without typing. The admin still confirms it — a detected field is a
 * suggestion, not an authority.
 */
export async function detectField(season: number): Promise<BracketTeam[]> {
  await ready();

  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, POSTSEASON_WEEK)));

  const bySeed = new Map<number, BracketTeam>();
  for (const g of rows) {
    if (!/playoff/i.test(g.notes ?? "")) continue;
    const sides: BracketTeam[] = [
      {
        seed: g.homeRank ?? 0,
        teamId: g.homeTeamId,
        name: g.homeName,
        short: g.homeShort,
        abbr: g.homeAbbr,
        logo: g.homeLogo,
        color: g.homeColor,
      },
      {
        seed: g.awayRank ?? 0,
        teamId: g.awayTeamId,
        name: g.awayName,
        short: g.awayShort,
        abbr: g.awayAbbr,
        logo: g.awayLogo,
        color: g.awayColor,
      },
    ];
    for (const s of sides) {
      if (s.seed < 1 || s.seed > 12) continue;
      // First-round games name every seed from 5 down; the quarterfinals add
      // the four byes. Either way the first sighting of a seed is the right one.
      if (!bySeed.has(s.seed)) bySeed.set(s.seed, s);
    }
  }

  return [...bySeed.values()].sort((a, b) => a.seed - b.seed);
}

export interface TeamOption {
  teamId: string;
  name: string;
  abbr: string;
}

/** Every team in this season's games, for seeding the field by hand. */
export async function getSeasonTeams(season: number): Promise<TeamOption[]> {
  await ready();
  const rows = await db.select().from(games).where(eq(games.season, season));

  const byId = new Map<string, TeamOption>();
  for (const g of rows) {
    byId.set(g.homeTeamId, { teamId: g.homeTeamId, name: g.homeName, abbr: g.homeAbbr });
    byId.set(g.awayTeamId, { teamId: g.awayTeamId, name: g.awayName, abbr: g.awayAbbr });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Nobody sits the playoff out. At the first kickoff, an unfinished bracket is
 * completed with chalk — every higher seed advancing — and flagged as auto, the
 * same bargain the weekly slate makes.
 *
 * Returns how many slots it filled.
 */
export async function fillMissingBrackets(season: number): Promise<number> {
  await ready();

  const view = await getPlayoff(season);
  if (!view.locked || view.field.length === 0) return 0;

  const now = Date.now();
  let filled = 0;

  for (const entry of view.entries) {
    // Chalk through their own bracket, so a first-round upset they did call
    // still sends that team on rather than being quietly overwritten.
    const chalk = completeWithChalk(view.field, entry.picks);
    const missing = SLOTS.filter((s) => !entry.picks[s.id] && chalk[s.id]);
    if (missing.length === 0) continue;

    // Their own picks stand; only the gaps get chalk. Insert one slot at a
    // time: the unique index is what makes a second run a no-op.
    for (const slot of missing) {
      await db
        .insert(bracketPicks)
        .values({
          playerId: entry.player.id,
          season,
          slot: slot.id,
          teamId: chalk[slot.id]!,
          auto: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
      filled++;
    }
  }

  return filled;
}
