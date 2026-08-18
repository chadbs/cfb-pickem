import { FAVORITE_TEAM_IDS, GAMES_PER_WEEK } from "./config";
import type { EspnGame } from "./espn";

export interface ScoredGame {
  game: EspnGame;
  score: number;
  reason: string;
}

const NATIONAL = /^(ABC|ESPN|ESPN2|FOX|CBS|NBC|TNT)$/i;

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

  const favHome = FAVORITE_TEAM_IDS[g.home.teamId];
  const favAway = FAVORITE_TEAM_IDS[g.away.teamId];
  if (favHome || favAway) {
    score += favHome && favAway ? 2200 : 1000;
    reasons.push(favHome && favAway ? `${favAway} vs ${favHome}` : (favHome ?? favAway)!);
  }

  // Ranked teams. A #2 is worth much more than a #24.
  for (const t of [g.home, g.away]) {
    if (t.rank) score += (26 - t.rank) * 4;
  }
  if (g.home.rank && g.away.rank) {
    score += 120;
    reasons.push(`#${g.away.rank} at #${g.home.rank}`);
  } else if (g.home.rank || g.away.rank) {
    const r = g.home.rank ?? g.away.rank!;
    if (r <= 10) reasons.push(`Top 10 team`);
  }

  // Tight lines make for better picking. A pick'em is worth +30, a 15-point
  // line nothing.
  if (g.spread !== null) {
    score += 10; // having a line at all is worth something — we need one to grade
    score += Math.max(0, 30 - Math.abs(g.spread) * 2);
    if (Math.abs(g.spread) <= 3.5) reasons.push("Coin flip");
  }

  if (g.broadcast && NATIONAL.test(g.broadcast)) {
    score += 25;
    reasons.push(g.broadcast);
  }

  // Primetime kickoff (>= 7pm ET).
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

/**
 * The week's slate: all favorite-team games, then the highest-scoring rest,
 * up to GAMES_PER_WEEK. Returned in kickoff order.
 */
export function selectWeek(games: EspnGame[], limit = GAMES_PER_WEEK): ScoredGame[] {
  const scored = games
    .filter((g) => g.home.teamId && g.away.teamId)
    .map(scoreGame)
    .sort((a, b) => b.score - a.score || a.game.kickoff - b.game.kickoff);

  return scored.slice(0, limit).sort((a, b) => a.game.kickoff - b.game.kickoff);
}
