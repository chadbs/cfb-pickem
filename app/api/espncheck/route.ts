import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * TEMPORARY. ESPN's edge returns 403 to Vercel's IP ranges for the host we use
 * locally, so this tries several host/header combinations from inside a
 * deployment to find one that works. Delete once the answer is known.
 */
const BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.espn.com/",
  Origin: "https://www.espn.com",
  "sec-ch-ua": '"Chromium";v="126", "Not:A-Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
};

const MINIMAL = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json",
};

const TARGETS: Array<[string, string, Record<string, string>]> = [
  [
    "site.api + minimal (current)",
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=5&dates=2026&seasontype=2&week=1",
    MINIMAL,
  ],
  [
    "site.api + full browser headers",
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=5&dates=2026&seasontype=2&week=1",
    BROWSER,
  ],
  [
    "site.api + no headers at all",
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=5&dates=2026&seasontype=2&week=1",
    {},
  ],
  [
    "cdn.espn.com core xhr",
    "https://cdn.espn.com/core/college-football/scoreboard?xhr=1&groups=80&year=2026&seasontype=2&week=1",
    BROWSER,
  ],
  [
    "site.web.api",
    "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=5&dates=2026&seasontype=2&week=1",
    BROWSER,
  ],
  [
    "sports.core.api (used for conferences)",
    "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2026/types/2/groups/80/children?limit=5",
    BROWSER,
  ],
];

export async function GET() {
  const results = [];
  for (const [label, url, headers] of TARGETS) {
    try {
      const r = await fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      const text = await r.text();
      let events: number | null = null;
      try {
        const j = JSON.parse(text);
        events = j.events?.length ?? j.content?.schedule ? -1 : (j.items?.length ?? null);
      } catch {
        /* not json */
      }
      results.push({
        label,
        status: r.status,
        bytes: text.length,
        events,
        snippet: r.ok ? undefined : text.replace(/\s+/g, " ").slice(0, 120),
      });
    } catch (err) {
      results.push({ label, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, results });
}
