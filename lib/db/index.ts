import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { PLAYERS } from "@/lib/config";

/**
 * Neon Postgres, provisioned through the Vercel marketplace, which injects
 * DATABASE_URL itself. `vercel env pull` puts the same value in .env.local for
 * local work, so there is one connection string and one code path.
 */
const url = process.env.DATABASE_URL;

const globalForDb = globalThis as unknown as {
  __pickemSql?: ReturnType<typeof postgres>;
  __pickemReady?: Promise<void>;
};

/**
 * `max: 1` because each serverless invocation is its own process — a larger
 * pool per instance just burns Neon connections. `prepare: false` is required
 * by Neon's pooled endpoint, which runs in transaction mode and can't hold
 * prepared statements across checkouts.
 */
const sql =
  globalForDb.__pickemSql ??
  postgres(url ?? "postgres://invalid", {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    // The idempotent bootstrap deliberately re-runs CREATE/ALTER ... IF NOT
    // EXISTS on every cold start, so Postgres' "already exists, skipping"
    // notices are expected rather than interesting.
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalForDb.__pickemSql = sql;

export const db = drizzle(sql, { schema });
/** Raw postgres client — used where drizzle's builder doesn't reach. */
export { sql };
export { schema };

/**
 * Schema bootstrap. Everything here is idempotent, so it can run on every cold
 * start — which means there is no migration step to forget during a deploy and
 * no way to end up with a live app pointed at an empty database.
 */
const DDL = [
  `CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    accent TEXT NOT NULL,
    initials TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    espn_id TEXT NOT NULL UNIQUE,
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    season_type INTEGER NOT NULL DEFAULT 2,
    kickoff BIGINT NOT NULL,
    home_team_id TEXT NOT NULL,
    home_name TEXT NOT NULL,
    home_short TEXT NOT NULL,
    home_abbr TEXT NOT NULL,
    home_logo TEXT,
    home_color TEXT,
    home_rank INTEGER,
    home_record TEXT,
    home_score INTEGER,
    home_conf_id TEXT,
    away_team_id TEXT NOT NULL,
    away_name TEXT NOT NULL,
    away_short TEXT NOT NULL,
    away_abbr TEXT NOT NULL,
    away_logo TEXT,
    away_color TEXT,
    away_rank INTEGER,
    away_record TEXT,
    away_score INTEGER,
    away_conf_id TEXT,
    neutral_site BOOLEAN NOT NULL DEFAULT FALSE,
    venue TEXT,
    broadcast TEXT,
    spread DOUBLE PRECISION,
    locked_spread DOUBLE PRECISION,
    over_under DOUBLE PRECISION,
    odds_provider TEXT,
    status TEXT NOT NULL DEFAULT 'pre',
    status_detail TEXT,
    period INTEGER,
    clock TEXT,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    selection_rank INTEGER,
    selection_score DOUBLE PRECISION,
    selection_reason TEXT,
    manual_pin BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS games_week_idx ON games (season, week)`,
  `CREATE INDEX IF NOT EXISTS games_selected_idx ON games (season, week, is_selected)`,
  `CREATE TABLE IF NOT EXISTS picks (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    game_id INTEGER NOT NULL REFERENCES games(id),
    side TEXT NOT NULL,
    spread_at_pick DOUBLE PRECISION,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS picks_player_game_idx ON picks (player_id, game_id)`,
  `CREATE INDEX IF NOT EXISTS picks_game_idx ON picks (game_id)`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
];

/**
 * Columns added after a table already existed. `CREATE TABLE IF NOT EXISTS` is
 * a no-op on an existing table, so those columns would never appear. Postgres
 * supports `ADD COLUMN IF NOT EXISTS`, which makes this a one-liner.
 */
const EXPECTED_COLUMNS: Array<[table: string, column: string, type: string]> = [
  ["games", "home_conf_id", "TEXT"],
  ["games", "away_conf_id", "TEXT"],
];

async function bootstrap() {
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision the Neon database in Vercel " +
        "(Storage → Create Database) and run `vercel env pull .env.local` for " +
        "local development. See README.md > Deploying.",
    );
  }

  for (const stmt of DDL) await sql.unsafe(stmt);
  for (const [table, column, type] of EXPECTED_COLUMNS) {
    await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
  }

  // Seed the roster. ON CONFLICT DO NOTHING means renaming someone in config.ts
  // won't clobber their row (or their picks) — edit the database for that.
  const now = Date.now();
  for (const [i, p] of PLAYERS.entries()) {
    await sql`
      INSERT INTO players (slug, name, accent, initials, sort, created_at)
      VALUES (${p.slug}, ${p.name}, ${p.accent}, ${p.initials}, ${i}, ${now})
      ON CONFLICT (slug) DO NOTHING
    `;
  }
}

/** Awaited before any query. Runs at most once per process. */
export function ready(): Promise<void> {
  globalForDb.__pickemReady ??= bootstrap();
  return globalForDb.__pickemReady;
}
