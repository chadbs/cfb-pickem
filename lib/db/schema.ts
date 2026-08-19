import { sqliteTable, integer, text, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  accent: text("accent").notNull(),
  initials: text("initials").notNull(),
  sort: integer("sort").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    espnId: text("espn_id").notNull().unique(),

    season: integer("season").notNull(),
    week: integer("week").notNull(),
    seasonType: integer("season_type").notNull().default(2),

    kickoff: integer("kickoff").notNull(), // epoch ms

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

    neutralSite: integer("neutral_site", { mode: "boolean" }).notNull().default(false),
    venue: text("venue"),
    broadcast: text("broadcast"),

    /**
     * Home-relative point spread: -7.5 means the home team is favored by 7.5.
     * Tracks the live line and stops mattering once `lockedSpread` is set.
     */
    spread: real("spread"),
    /**
     * The line every pick is graded against, frozen at kickoff. ESPN removes
     * odds from a game once it goes final, so without this snapshot the number
     * we need to score the week would simply vanish.
     */
    lockedSpread: real("locked_spread"),
    overUnder: real("over_under"),
    oddsProvider: text("odds_provider"),

    status: text("status").notNull().default("pre"), // pre | in | post
    statusDetail: text("status_detail"),
    period: integer("period"),
    clock: text("clock"),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),

    /** Whether this game is one of the week's 10. */
    isSelected: integer("is_selected", { mode: "boolean" }).notNull().default(false),
    selectionRank: integer("selection_rank"),
    selectionScore: real("selection_score"),
    selectionReason: text("selection_reason"),
    /** Set when a human overrides the auto-picker so sync stops second-guessing it. */
    manualPin: integer("manual_pin", { mode: "boolean" }).notNull().default(false),

    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("games_week_idx").on(t.season, t.week),
    index("games_selected_idx").on(t.season, t.week, t.isSelected),
  ],
);

export const picks = sqliteTable(
  "picks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id),
    /** Which side of the spread they took. */
    side: text("side").notNull(), // home | away
    /** The line shown in the UI at the moment they picked — for "you got a better number" trivia. */
    spreadAtPick: real("spread_at_pick"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("picks_player_game_idx").on(t.playerId, t.gameId),
    index("picks_game_idx").on(t.gameId),
  ],
);

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type Player = typeof players.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Pick = typeof picks.$inferSelect;
