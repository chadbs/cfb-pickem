import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { PLAYERS } from "@/lib/config";

/**
 * One code path for both environments: a plain SQLite file locally, Turso in
 * production. Set DATABASE_URL to a libsql:// URL plus DATABASE_AUTH_TOKEN and
 * nothing else changes.
 */
const url = process.env.DATABASE_URL ?? "file:./data/pickem.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (url.startsWith("file:")) {
  // libsql won't create the parent directory for us.
  mkdirSync(dirname(resolve(url.slice("file:".length))), { recursive: true });
}

const globalForDb = globalThis as unknown as { __pickemClient?: Client; __pickemReady?: Promise<void> };

const client = globalForDb.__pickemClient ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== "production") globalForDb.__pickemClient = client;

export const db = drizzle(client, { schema });
export { schema };

/**
 * Schema bootstrap. Everything here is idempotent, so it can run on every cold
 * start — which means there is no migration step to forget during a deploy and
 * no way to end up with a live app pointed at an empty database.
 */
const DDL = [
  `CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    accent TEXT NOT NULL,
    initials TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    espn_id TEXT NOT NULL UNIQUE,
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    season_type INTEGER NOT NULL DEFAULT 2,
    kickoff INTEGER NOT NULL,
    home_team_id TEXT NOT NULL,
    home_name TEXT NOT NULL,
    home_short TEXT NOT NULL,
    home_abbr TEXT NOT NULL,
    home_logo TEXT,
    home_color TEXT,
    home_rank INTEGER,
    home_record TEXT,
    home_score INTEGER,
    away_team_id TEXT NOT NULL,
    away_name TEXT NOT NULL,
    away_short TEXT NOT NULL,
    away_abbr TEXT NOT NULL,
    away_logo TEXT,
    away_color TEXT,
    away_rank INTEGER,
    away_record TEXT,
    away_score INTEGER,
    neutral_site INTEGER NOT NULL DEFAULT 0,
    venue TEXT,
    broadcast TEXT,
    spread REAL,
    locked_spread REAL,
    over_under REAL,
    odds_provider TEXT,
    status TEXT NOT NULL DEFAULT 'pre',
    status_detail TEXT,
    period INTEGER,
    clock TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    is_selected INTEGER NOT NULL DEFAULT 0,
    selection_rank INTEGER,
    selection_score REAL,
    selection_reason TEXT,
    manual_pin INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS games_week_idx ON games (season, week)`,
  `CREATE INDEX IF NOT EXISTS games_selected_idx ON games (season, week, is_selected)`,
  `CREATE TABLE IF NOT EXISTS picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id),
    game_id INTEGER NOT NULL REFERENCES games(id),
    side TEXT NOT NULL,
    spread_at_pick REAL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS picks_player_game_idx ON picks (player_id, game_id)`,
  `CREATE INDEX IF NOT EXISTS picks_game_idx ON picks (game_id)`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

async function bootstrap() {
  for (const stmt of DDL) await client.execute(stmt);

  // Seed the roster. ON CONFLICT DO NOTHING means renaming someone in config.ts
  // won't clobber their row (or their picks) — edit the DB for that.
  const now = Date.now();
  for (const [i, p] of PLAYERS.entries()) {
    await client.execute({
      sql: `INSERT INTO players (slug, name, accent, initials, sort, created_at)
            VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING`,
      args: [p.slug, p.name, p.accent, p.initials, i, now],
    });
  }
}

/** Awaited before any query. Runs at most once per process. */
export function ready(): Promise<void> {
  globalForDb.__pickemReady ??= bootstrap();
  return globalForDb.__pickemReady;
}
