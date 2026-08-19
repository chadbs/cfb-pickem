/* eslint-disable @typescript-eslint/no-explicit-any --
 * This module is the boundary against an undocumented third-party JSON feed.
 * Its shape varies by game state (odds vanish on final, ranks and records come
 * and go), so it's read defensively with optional chaining and normalised into
 * the typed structures below. Modelling the raw payload would imply guarantees
 * ESPN doesn't give us. Everything past this file is fully typed. */
import { FBS_GROUP, UNRANKED } from "./config";

/**
 * ESPN's public scoreboard feed. No API key, no rate limit we've ever hit, and
 * it carries live DraftKings lines alongside scores — which is the only reason
 * this whole app needs zero paid services.
 *
 * It does reject requests that don't look like a browser, hence the UA.
 */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json",
};

/**
 * ESPN's edge decides using IP reputation *and* headers, and the two pull in
 * opposite directions:
 *
 *   - From a normal connection, a request with no browser User-Agent is
 *     refused (PowerShell's default UA gets a 403).
 *   - From a datacenter IP — Vercel — a browser User-Agent is what gets
 *     refused, because "Chrome" from a server range reads as a bot. The same
 *     request with no headers at all succeeds.
 *
 * So there's no single set of headers that works everywhere. Try a few
 * host/header profiles, and remember whichever one answered so the cost is paid
 * once per process rather than on every call.
 */
const PROFILES: Array<{ base: string; headers: Record<string, string> }> = [
  // Verified 200 from Vercel (iad1).
  {
    base: "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football",
    headers: HEADERS,
  },
  // Verified 200 from Vercel with no headers whatsoever.
  {
    base: "https://site.api.espn.com/apis/site/v2/sports/football/college-football",
    headers: {},
  },
  // Verified 200 from a normal connection.
  {
    base: "https://site.api.espn.com/apis/site/v2/sports/football/college-football",
    headers: HEADERS,
  },
];

let preferredProfile = 0;

export type GameStatus = "pre" | "in" | "post";

export interface EspnTeamSide {
  teamId: string;
  name: string;
  short: string;
  abbr: string;
  logo: string | null;
  color: string | null;
  rank: number | null;
  record: string | null;
  score: number | null;
  /** ESPN conference id — 8 is the SEC, 5 the Big Ten, and so on. */
  conferenceId: string | null;
}

export interface EspnGame {
  espnId: string;
  season: number;
  week: number;
  seasonType: number;
  kickoff: number;
  home: EspnTeamSide;
  away: EspnTeamSide;
  neutralSite: boolean;
  venue: string | null;
  broadcast: string | null;
  /** Home-relative: negative means the home team is favored. Null when no line is posted yet. */
  spread: number | null;
  overUnder: number | null;
  oddsProvider: string | null;
  status: GameStatus;
  statusDetail: string | null;
  period: number | null;
  clock: string | null;
  completed: boolean;
}

export interface WeekEntry {
  week: number;
  label: string;
  detail: string;
  startDate: string;
  endDate: string;
}

export interface CurrentWeek {
  season: number;
  week: number;
  seasonType: number;
  weeks: WeekEntry[];
}

async function getJson(path: string): Promise<any> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < PROFILES.length; attempt++) {
    const index = (preferredProfile + attempt) % PROFILES.length;
    const profile = PROFILES[index];
    try {
      const res = await fetch(`${profile.base}${path}`, {
        headers: profile.headers,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        preferredProfile = index;
        return await res.json();
      }
      lastError = new Error(`ESPN ${path} -> ${res.status} (profile ${index})`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`ESPN ${path} failed`);
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Turn ESPN's odds blob into a spread stated from the home team's point of view
 * (-7.5 = home favored by 7.5).
 *
 * This needs care. The raw `spread` field's sign is not consistently
 * home-relative across games, and `details` is a string like "TCU -7.5" whose
 * team may be either side. So we read the string and resolve which side it names,
 * falling back to the explicit favorite flags, and only then to the raw number.
 */
export function deriveHomeSpread(
  odds: any,
  homeAbbr: string,
  awayAbbr: string,
): number | null {
  if (!odds) return null;

  const homeAbbrs = new Set(
    [homeAbbr, odds.homeTeamOdds?.team?.abbreviation].filter(Boolean).map((s: string) => s.toUpperCase()),
  );
  const awayAbbrs = new Set(
    [awayAbbr, odds.awayTeamOdds?.team?.abbreviation].filter(Boolean).map((s: string) => s.toUpperCase()),
  );

  const details: string | undefined = odds.details;
  if (typeof details === "string") {
    const d = details.trim();
    if (/^(even|pk|pick('?em)?)$/i.test(d)) return 0;

    const m = d.match(/^([A-Za-z0-9&.'-]+)\s*([+-]\s*\d+(?:\.\d+)?)$/);
    if (m) {
      const abbr = m[1].toUpperCase();
      const value = Number(m[2].replace(/\s+/g, ""));
      if (Number.isFinite(value)) {
        if (homeAbbrs.has(abbr)) return value;
        if (awayAbbrs.has(abbr)) return -value;
      }
    }
  }

  // No usable string — trust the explicit favorite flag with the magnitude.
  const raw = num(odds.spread);
  if (raw !== null) {
    const mag = Math.abs(raw);
    if (odds.homeTeamOdds?.favorite === true) return -mag;
    if (odds.awayTeamOdds?.favorite === true) return mag;
    return raw; // Last resort: assume it was already home-relative.
  }

  return null;
}

/** Prefer the highest-priority book that actually posted a line. */
function bestOdds(oddsList: any[] | undefined): any | null {
  if (!Array.isArray(oddsList) || oddsList.length === 0) return null;
  const usable = oddsList.filter((o) => o?.details != null || o?.spread != null);
  if (usable.length === 0) return null;
  return [...usable].sort(
    (a, b) => (a.provider?.priority ?? 99) - (b.provider?.priority ?? 99),
  )[0];
}

function side(c: any): EspnTeamSide {
  const rank = c?.curatedRank?.current;
  return {
    teamId: String(c?.team?.id ?? ""),
    name: c?.team?.displayName ?? c?.team?.location ?? "TBD",
    short: c?.team?.shortDisplayName ?? c?.team?.location ?? "TBD",
    abbr: c?.team?.abbreviation ?? "—",
    logo: c?.team?.logo ?? null,
    color: c?.team?.color ? `#${String(c.team.color).replace(/^#/, "")}` : null,
    rank: typeof rank === "number" && rank !== UNRANKED ? rank : null,
    record: c?.records?.find((r: any) => r.type === "total")?.summary ?? c?.records?.[0]?.summary ?? null,
    score: num(c?.score),
    conferenceId: c?.team?.conferenceId != null ? String(c.team.conferenceId) : null,
  };
}

function normalizeEvent(event: any): EspnGame | null {
  const comp = event?.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find((c: any) => c.homeAway === "home");
  const away = comp.competitors?.find((c: any) => c.homeAway === "away");
  if (!home || !away) return null;

  const h = side(home);
  const a = side(away);
  const odds = bestOdds(comp.odds);

  const state = comp.status?.type?.state as GameStatus | undefined;

  return {
    espnId: String(event.id),
    season: event.season?.year ?? new Date(event.date).getUTCFullYear(),
    week: event.week?.number ?? 0,
    seasonType: event.season?.type ?? 2,
    kickoff: new Date(event.date).getTime(),
    home: h,
    away: a,
    neutralSite: Boolean(comp.neutralSite),
    venue: comp.venue?.fullName ?? null,
    broadcast: comp.broadcasts?.[0]?.names?.[0] ?? null,
    spread: deriveHomeSpread(odds, h.abbr, a.abbr),
    overUnder: num(odds?.overUnder),
    oddsProvider: odds?.provider?.name ?? null,
    status: state === "in" || state === "post" ? state : "pre",
    statusDetail: comp.status?.type?.shortDetail ?? null,
    period: num(comp.status?.period),
    clock: comp.status?.displayClock ?? null,
    completed: Boolean(comp.status?.type?.completed),
  };
}

/** Every FBS game in a given week. */
export async function fetchWeek(
  season: number,
  week: number,
  seasonType = 2,
): Promise<EspnGame[]> {
  const data = await getJson(
    `/scoreboard?groups=${FBS_GROUP}&limit=400&dates=${season}&seasontype=${seasonType}&week=${week}`,
  );
  return (data.events ?? [])
    .map(normalizeEvent)
    .filter((g: EspnGame | null): g is EspnGame => g !== null)
    // ESPN occasionally returns a stray game from an adjacent week.
    .map((g: EspnGame) => ({ ...g, season, week, seasonType }));
}

/**
 * FBS conference id → short name ("8" → "SEC").
 *
 * The public groups endpoint only goes down to division level, so this walks
 * the core API's children of group 80. Eleven small requests, cached for a long
 * time by the caller — conference membership shifts, the ids don't.
 */
export async function fetchConferences(season: number): Promise<Record<string, string>> {
  const base = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";
  const listUrl = `${base}/seasons/${season}/types/2/groups/${FBS_GROUP}/children?limit=50`;

  const res = await fetch(listUrl, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ESPN conferences -> ${res.status}`);
  const list = await res.json();

  const out: Record<string, string> = {};
  const refs: string[] = (list.items ?? []).map((i: any) => i.$ref).filter(Boolean);

  await Promise.all(
    refs.map(async (ref) => {
      try {
        const r = await fetch(ref, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(15_000) });
        if (!r.ok) return;
        const g = await r.json();
        if (g?.id) out[String(g.id)] = g.shortName ?? g.name ?? String(g.id);
      } catch {
        /* one missing conference shouldn't sink the batch */
      }
    }),
  );

  return out;
}

/** Which week is live right now, plus the full week list for the season nav. */
export async function fetchCurrentWeek(): Promise<CurrentWeek> {
  const data = await getJson(`/scoreboard?groups=${FBS_GROUP}&limit=1`);

  const season: number = data.season?.year ?? data.leagues?.[0]?.season?.year ?? new Date().getUTCFullYear();
  const seasonType: number = data.season?.type ?? 2;
  const week: number = data.week?.number ?? 1;

  const regular = data.leagues?.[0]?.calendar?.find((c: any) => String(c.value) === "2");
  const weeks: WeekEntry[] = (regular?.entries ?? []).map((e: any) => ({
    week: Number(e.value),
    label: e.label,
    detail: e.detail ?? "",
    startDate: e.startDate,
    endDate: e.endDate,
  }));

  return {
    season,
    week,
    seasonType: seasonType === 3 ? 2 : seasonType, // keep the pool in the regular season
    weeks: weeks.length ? weeks : [{ week: 1, label: "Week 1", detail: "", startDate: "", endDate: "" }],
  };
}
