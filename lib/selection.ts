import { CONFERENCE_WEIGHT, FAVORITE_TEAM_IDS, GAMES_PER_WEEK } from "./config";
import type { EspnGame } from "./espn";

export interface ScoredGame {
  game: EspnGame;
  score: number;
  reason: string;
}

const NATIONAL = /^(ABC|ESPN|ESPN2|FOX|CBS|NBC|TNT)$/i;

/**
 * Band sizes. Each is larger than everything that can accumulate below it, so
 * the ordering is: our teams, then ranked games, then conference weight, then
 * how close the line is. The blowout penalty is the one thing allowed to cross
 * bands — a 40-point mismatch should fall behind an even game whatever else is
 * true about it.
 */
const FAVOURITE_ONE = 100_000;
const FAVOURITE_BOTH = 220_000;
const RANKED_ONE = 10_000;
const RANKED_BOTH = 22_000;
const RANK_QUALITY = 20;
const COMPETITIVE_BONUS = 120;
const COMPETITIVE_DECAY = 8;
const BLOWOUT_FROM = 14;
const BLOWOUT_WEIGHT = 700;
/** No posted line yet — can't tell if it's worth watching, so nudge it down. */
const NO_LINE_PENALTY = -150;

export function isFavorite(g: EspnGame): string | null {
  return (
    FAVORITE_TEAM_IDS[g.home.teamId] ?? FAVORITE_TEAM_IDS[g.away.teamId] ?? null
  );
}

/**
 * Rank every game in the week by how much we'd want to pick it.
 *
 * The favorite-team bonus is deliberately larger than anything else combined:
 * a Colorado game gets a slot even if it's a 40-point mismatch on a Tuesday.
 * Everything below that is just "is this a good football game".
 */
export function scoreGame(g: EspnGame): ScoredGame {
  let score = 0;
  const reasons: string[] = [];

  // 1. Our four teams, above everything else. A Colorado game belongs on the
  //    slate whoever it's against.
  const favHome = FAVORITE_TEAM_IDS[g.home.teamId];
  const favAway = FAVORITE_TEAM_IDS[g.away.teamId];
  if (favHome || favAway) {
    score += favHome && favAway ? FAVOURITE_BOTH : FAVOURITE_ONE;
    reasons.push(favHome && favAway ? `${favAway} vs ${favHome}` : (favHome ?? favAway)!);
  }

  // 2. Anything with a ranked team, ahead of everything unranked. The band is
  //    wide enough that conference weight and TV can't lift an unranked game
  //    past a ranked one.
  const ranks = [g.home.rank, g.away.rank].filter((r): r is number => r !== null);
  if (ranks.length === 2) {
    score += RANKED_BOTH;
    reasons.push(`#${g.away.rank} at #${g.home.rank}`);
  } else if (ranks.length === 1) {
    score += RANKED_ONE;
    if (ranks[0] <= 10) reasons.push("Top 10 team");
  }
  // Better ranks first within the band.
  for (const r of ranks) score += (26 - r) * RANK_QUALITY;

  // 3. Conference weight: Big Ten, SEC, Big 12, Pac-12, ACC, then the rest.
  score += CONFERENCE_WEIGHT[g.home.conferenceId ?? ""] ?? 0;
  score += CONFERENCE_WEIGHT[g.away.conferenceId ?? ""] ?? 0;

  // 4. The line. A close game is worth watching; a mismatch is not, and the
  //    penalty is deliberately steep enough to sink a ranked side beating up
  //    on a cupcake past an even game between two unranked ones.
  if (g.spread === null) {
    score += NO_LINE_PENALTY;
  } else {
    const margin = Math.abs(g.spread);
    score += Math.max(0, COMPETITIVE_BONUS - margin * COMPETITIVE_DECAY);
    if (margin > BLOWOUT_FROM) score -= (margin - BLOWOUT_FROM) * BLOWOUT_WEIGHT;
    if (margin <= 3.5) reasons.push("Coin flip");
    else if (margin >= 24) reasons.push("Mismatch");
  }

  // 5. Tiebreakers.
  if (g.broadcast && NATIONAL.test(g.broadcast)) {
    score += 25;
    reasons.push(g.broadcast);
  }
  const etHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(new Date(g.kickoff)),
  );
  if (etHour >= 19 || etHour < 4) score += 15;
  if (g.neutralSite) score += 10;

  return { game: g, score, reason: reasons.slice(0, 2).join(" · ") || "Best of the week" };
}

/** Every game in the week, best first. Drives the admin picker. */
export function rankGames(games: EspnGame[]): ScoredGame[] {
  return games
    .filter((g) => g.home.teamId && g.away.teamId)
    .map(scoreGame)
    .sort((a, b) => b.score - a.score || a.game.kickoff - b.game.kickoff);
}

/**
 * The week's slate: all favorite-team games, then the highest-scoring rest,
 * up to GAMES_PER_WEEK. Returned in kickoff order.
 */
export function selectWeek(games: EspnGame[], limit = GAMES_PER_WEEK): ScoredGame[] {
  return rankGames(games)
    .slice(0, limit)
    .sort((a, b) => a.game.kickoff - b.game.kickoff);
}
