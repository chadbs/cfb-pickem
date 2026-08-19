import {
  pgTable,
  serial,
  integer,
  bigint,
  text,
  doublePrecision,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Timestamps are epoch milliseconds in BIGINT rather than Postgres `timestamp`.
 * Everything upstream — ESPN kickoffs, Date.now() — is already epoch ms, and a
 * round trip through a date type only invites timezone bugs. Well inside the
 * safe integer range, so `mode: "number"` is honest.
 */
const epochMs = (name: string) => bigint(name, { mode: "number" });

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  accent: text("accent").notNull(),
  initials: text("initials").notNull(),
  sort: integer("sort").notNull().default(0),
  createdAt: epochMs("created_at").notNull(),
});

export const games = pgTable(
  "games",
  {
    id: serial("id").primaryKey(),
    espnId: text("espn_id").notNull().unique(),

    season: integer("season").notNull(),
    week: integer("week").notNull(),
    seasonType: integer("season_type").notNull().default(2),

    kickoff: epochMs("kickoff").notNull(),

    homeTeamId: text("home_team_id").notNull(),
    homeName: text("home_name").notNull(),
    homeShort: text("home_short").notNull(),
    homeAbbr: text("home_abbr").notNull(),
    homeLogo: text("home_logo"),
    homeColor: text("home_color"),
    homeRank: integer("home_rank"),
    homeRecord: text("home_record"),
    homeScore: integer("home_score"),
    homeConfId: text("home_conf_id"),

    awayTeamId: text("away_team_id").notNull(),
    awayName: text("away_name").notNull(),
    awayShort: text("away_short").notNull(),
    awayAbbr: text("away_abbr").notNull(),
    awayLogo: text("away_logo"),
    awayColor: text("away_color"),
    awayRank: integer("away_rank"),
    awayRecord: text("away_record"),
    awayScore: integer("away_score"),
    awayConfId: text("away_conf_id"),

    neutralSite: boolean("neutral_site").notNull().default(false),
    venue: text("venue"),
    broadcast: text("broadcast"),

    /**
     * Home-relative point spread: -7.5 means the home team is favored by 7.5.
     * Tracks the live line and stops mattering once `lockedSpread` is set.
     */
    spread: doublePrecision("spread"),
    /**
     * The line frozen at kickoff. ESPN removes odds from a game once it goes
     * final, so without this snapshot the number needed to score the week would
     * simply vanish.
     */
    lockedSpread: doublePrecision("locked_spread"),
    overUnder: doublePrecision("over_under"),
    oddsProvider: text("odds_provider"),

    status: text("status").notNull().default("pre"), // pre | in | post
    statusDetail: text("status_detail"),
    period: integer("period"),
    clock: text("clock"),
    completed: boolean("completed").notNull().default(false),

    /** Whether this game is one of the week's 10. */
    isSelected: boolean("is_selected").notNull().default(false),
    selectionRank: integer("selection_rank"),
    selectionScore: doublePrecision("selection_score"),
    selectionReason: text("selection_reason"),
    /** Set when a human overrides the auto-picker. */
    manualPin: boolean("manual_pin").notNull().default(false),

    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [
    index("games_week_idx").on(t.season, t.week),
    index("games_selected_idx").on(t.season, t.week, t.isSelected),
  ],
);

export const picks = pgTable(
  "picks",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id),
    /** Which side of the spread they took. */
    side: text("side").notNull(), // home | away
    /** The line showing when they picked — what this pick is graded against. */
    spreadAtPick: doublePrecision("spread_at_pick"),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("picks_player_game_idx").on(t.playerId, t.gameId),
    index("picks_game_idx").on(t.gameId),
  ],
);

export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: epochMs("updated_at").notNull(),
});

export type Player = typeof players.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Pick = typeof picks.$inferSelect;
