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
 * Mountain West, Pac-12, ACC, Big Ten, SEC, Big 12.
 *
 * No Big East — it doesn't sponsor FBS football, so ESPN lists no such
 * conference. Notre Dame is an FBS Independent ("18") and so isn't in this set
 * either; the editor's "All FBS" toggle reaches independents, the MAC, Sun Belt,
 * CUSA and the American.
 */
export const CANDIDATE_CONFERENCE_IDS = ["17", "9", "1", "5", "8", "4"];

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
