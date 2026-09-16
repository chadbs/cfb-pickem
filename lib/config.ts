/**
 * League configuration. Everything tweakable about the pool lives here.
 */

export const LEAGUE_NAME = "The Pick'em";

/** How many games get picked each week. */
export const GAMES_PER_WEEK = 10;

/**
 * The four of us. `slug` is used in URLs and localStorage, so changing one
 * orphans that player's saved selection in the browser (picks in the DB are
 * keyed on the numeric id and survive fine).
 */
export const PLAYERS = [
  { slug: "darren", name: "Darren", accent: "#f59e0b", initials: "D" },
  { slug: "chad", name: "Chad", accent: "#38bdf8", initials: "C" },
  { slug: "jake", name: "Jake", accent: "#a78bfa", initials: "J" },
  { slug: "eric", name: "Eric", accent: "#34d399", initials: "E" },
] as const;

/**
 * Home teams. ESPN team ids — verified against the /teams endpoint.
 * Any game involving one of these is near-guaranteed a slot in the week.
 */
export const FAVORITE_TEAM_IDS: Record<string, string> = {
  "38": "Colorado",
  "36": "Colorado State",
  "158": "Nebraska",
  "130": "Michigan",
};

/**
 * Conferences offered by default in the slate editor, by ESPN conference id:
 * Big Ten, SEC, Big 12, Pac-12, ACC, Mountain West, and FBS Independents —
 * which is how Notre Dame gets in.
 *
 * No Big East: it doesn't sponsor FBS football, so ESPN lists no such
 * conference. The editor's "All FBS" toggle reaches the MAC, Sun Belt, CUSA
 * and the American.
 */
export const CANDIDATE_CONFERENCE_IDS = ["5", "8", "4", "9", "1", "17", "18"];

/**
 * How much a conference pulls a game up the list, by ESPN conference id. Both
 * teams' weights are added, so two power-conference sides outrank a power side
 * playing a group-of-five one.
 */
export const CONFERENCE_WEIGHT: Record<string, number> = {
  "5": 1000, // Big Ten
  "8": 950, // SEC
  "4": 900, // Big 12
  "9": 850, // Pac-12
  "1": 800, // ACC
  "18": 780, // FBS Independents — Notre Dame
  "151": 400, // American
  "17": 350, // Mountain West
  "37": 300, // Sun Belt
  "12": 250, // CUSA
  "15": 200, // MAC
};

/**
 * A favourite laying this many points or more is treated as inflated, and the
 * auto-pick takes the underdog instead. Below it the home side is taken.
 */
export const AUTO_PICK_BIG_FAVORITE = 14;

/**
 * Lock of the week. One pick a week can be locked, and it counts double: a hit
 * adds this on top of the win, a miss takes it off. A push is unaffected —
 * there's no result to double. Locking is optional; miss it and the week simply
 * scores normally.
 */
export const LOCK_BONUS = 1;

/**
 * Whose game becomes your lock when you don't call one, by player slug and ESPN
 * team id. Nobody goes a week without a lock, and a default you'd have argued
 * for anyway beats an arbitrary one: Jake gets Nebraska, Chad Colorado State,
 * Darren and Eric Colorado.
 *
 * If that team isn't on the slate, the fallback walks the other home teams in
 * `LOCK_FALLBACK_ORDER` and then, failing all of that, takes the week's first
 * kickoff. The rule is in [`lib/locks.ts`](locks.ts).
 *
 * The order is spelled out rather than read off `FAVORITE_TEAM_IDS`: those keys
 * are integer-like strings, so JavaScript hands them back in numeric order —
 * 36, 38, 130, 158 — which is not the order anyone wrote them in and not
 * something the fallback should depend on by accident.
 */
export const LOCK_FALLBACK_ORDER = ["38", "36", "158", "130"]; // CU, CSU, Nebraska, Michigan

export const DEFAULT_LOCK_TEAM_IDS: Record<string, string> = {
  jake: "158", // Nebraska
  chad: "36", // Colorado State
  darren: "38", // Colorado
  eric: "38", // Colorado
};

/**
 * Order of the conference tabs on /insights: the four asked about by name, then
 * the ACC. Everything else follows by CONFERENCE_WEIGHT.
 */
export const CONFERENCE_SPOTLIGHT = ["4", "9", "8", "5", "1"]; // Big 12, Pac-12, SEC, Big Ten, ACC

/**
 * The postseason is one extra week in this app, numbered above the regular
 * season's fifteen.
 *
 * ESPN packs the entire postseason into a single week — seasontype 3, week 1 —
 * bowls and every playoff round together, 46 games in 2025. Mapping that onto
 * one synthetic week number means every `(season, week)` query, the week nav and
 * the standings keep working with no special cases, and the bowl slate is picked
 * and graded exactly like any other week.
 *
 * The playoff games in there are also the bracket's source of truth; see
 * [`lib/bracket.ts`](bracket.ts).
 */
export const POSTSEASON_WEEK = 16;
export const POSTSEASON_SEASON_TYPE = 3;
export const POSTSEASON_LABEL = "Bowls";

/**
 * Playoff bracket scoring. Rounds double — a first-round game is worth 1 and
 * the title game 8, so 28 points are on the table before bonuses.
 *
 * On top of that, calling a game correctly when the lower seed wins pays the
 * seed difference: a 12 over a 5 adds 7. It's deliberately generous, because
 * one person calling the chaos right should be able to win the bracket from
 * behind — and it pays nothing for merely liking an underdog that loses.
 */
export const BRACKET_SIZE = 12;
export const BRACKET_ROUND_POINTS = { r1: 1, qf: 2, sf: 4, final: 8 } as const;
export const BRACKET_UPSET_BONUS_PER_SEED = 1;

/** ESPN group 80 = FBS (I-A). */
export const FBS_GROUP = "80";

/** ESPN's `curatedRank.current` uses 99 to mean "unranked". */
export const UNRANKED = 99;

/**
 * Sync throttle. Games in progress get refreshed aggressively; otherwise we
 * back off so casual page loads don't hammer ESPN.
 */
export const SYNC_TTL_LIVE_MS = 25_000;
export const SYNC_TTL_IDLE_MS = 10 * 60_000;

/** Optional shared secret for the cron endpoint. */
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

/** Set to lock the admin tools behind a passphrase. Empty = open. */
export const ADMIN_KEY = process.env.ADMIN_KEY ?? "";

/**
 * Preseason calls on our four teams, made before week 1, keyed by player slug
 * then ESPN team id. Static on purpose — they were made once and shouldn't be
 * editable after the fact.
 *
 * 36 Colorado State · 38 Colorado · 158 Nebraska · 130 Michigan
 */
export const SEASON_PREDICTIONS: Record<string, Record<string, [wins: number, losses: number]>> = {
  darren: { "36": [6, 6], "38": [7, 5], "158": [6, 6], "130": [8, 4] },
  eric: { "36": [7, 5], "38": [8, 4], "158": [7, 5], "130": [8, 4] },
  jake: { "36": [6, 6], "38": [4, 8], "158": [6, 6], "130": [8, 4] },
  chad: { "36": [8, 4], "38": [3, 9], "158": [5, 7], "130": [9, 3] },
};

/** A regular season is twelve games; accuracy is only scored once one is done. */
export const REGULAR_SEASON_GAMES = 12;
