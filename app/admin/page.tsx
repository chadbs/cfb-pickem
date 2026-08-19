import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { SlateEditor } from "@/components/SlateEditor";
import { ADMIN_KEY, GAMES_PER_WEEK, LEAGUE_NAME } from "@/lib/config";
import { db, ready, schema } from "@/lib/db";
import { fetchWeek } from "@/lib/espn";
import { isFavorite, rankGames } from "@/lib/selection";
import { getCurrentWeek } from "@/lib/sync";
import type { CandidateView } from "@/lib/view-types";

export const dynamic = "force-dynamic";

/** How many games to offer beyond the ten that get chosen automatically. */
const CANDIDATE_COUNT = 20;

type GameRow = typeof schema.games.$inferSelect;

/**
 * Kept out of the component body so the current time isn't read during render.
 */
function buildCandidates(
  espnGames: Awaited<ReturnType<typeof fetchWeek>>,
  selectedRows: GameRow[],
  pickCounts: Map<number, number>,
): CandidateView[] {
  const now = Date.now();
  const selectedByEspnId = new Map(selectedRows.map((g) => [g.espnId, g]));
  const ranked = rankGames(espnGames);

  // The top N, plus anything already on the slate that ranked below them — a
  // hand-picked game must never quietly vanish from the list.
  const shortlist = ranked.slice(0, CANDIDATE_COUNT);
  const shown = new Set(shortlist.map((s) => s.game.espnId));
  for (const s of ranked) {
    if (selectedByEspnId.has(s.game.espnId) && !shown.has(s.game.espnId)) {
      shortlist.push(s);
      shown.add(s.game.espnId);
    }
  }

  const autoTen = new Set(ranked.slice(0, GAMES_PER_WEEK).map((s) => s.game.espnId));

  return shortlist.map((s) => {
    const row = selectedByEspnId.get(s.game.espnId);
    const started = row ? now >= row.kickoff || row.status !== "pre" : now >= s.game.kickoff;
    const pickCount = row ? (pickCounts.get(row.id) ?? 0) : 0;
    return {
      espnId: s.game.espnId,
      kickoff: s.game.kickoff,
      awayAbbr: s.game.away.abbr,
      homeAbbr: s.game.home.abbr,
      awayName: s.game.away.name,
      homeName: s.game.home.name,
      awayLogo: s.game.away.logo,
      homeLogo: s.game.home.logo,
      awayRank: s.game.away.rank,
      homeRank: s.game.home.rank,
      neutralSite: s.game.neutralSite,
      spread: s.game.spread,
      broadcast: s.game.broadcast,
      score: Math.round(s.score),
      reason: s.reason,
      favorite: isFavorite(s.game),
      selected: Boolean(row),
      recommended: autoTen.has(s.game.espnId),
      pickCount,
      // Locked rows can't be unchecked: removing them would delete real picks.
      locked: Boolean(row) && (pickCount > 0 || started),
    };
  });
}

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;

  // Optional gate. With ADMIN_KEY unset the page is simply open, which is fine
  // for a four-person pool; set it in the environment to lock the page down.
  const key = Array.isArray(sp.key) ? sp.key[0] : sp.key;
  if (ADMIN_KEY && key !== ADMIN_KEY) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4">
        <div className="card w-full px-5 py-8 text-center">
          <p className="text-[14px] font-semibold">Admin locked</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
            Add <code className="text-[var(--ink-dim)]">?key=…</code> to the URL to edit the slate.
          </p>
          <Link href="/" className="mt-4 inline-block text-[12.5px] text-[var(--brand)] hover:underline">
            ← Back to picks
          </Link>
        </div>
      </main>
    );
  }

  await ready();
  const current = await getCurrentWeek();
  const raw = Array.isArray(sp.week) ? sp.week[0] : sp.week;
  const asked = Number(raw);
  const week = Number.isInteger(asked) && asked >= 1 && asked <= 20 ? asked : current.week;
  const season = current.season;

  const [espnGames, selectedRows] = await Promise.all([
    fetchWeek(season, week),
    // Only the slate — the table also holds every other game in the week.
    db
      .select()
      .from(schema.games)
      .where(
        and(
          eq(schema.games.season, season),
          eq(schema.games.week, week),
          eq(schema.games.isSelected, true),
        ),
      ),
  ]);

  const pickCounts = new Map<number, number>();
  if (selectedRows.length) {
    const rows = await db
      .select({ gameId: schema.picks.gameId })
      .from(schema.picks)
      .where(inArray(schema.picks.gameId, selectedRows.map((g) => g.id)));
    for (const r of rows) pickCounts.set(r.gameId, (pickCounts.get(r.gameId) ?? 0) + 1);
  }

  const candidates = buildCandidates(espnGames, selectedRows, pickCounts);

  return (
    <>
      <header className="glass sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-[900px] items-center gap-3 px-4 py-2.5 lg:px-6">
          <Link href="/" className="ctl flex h-8 items-center px-2.5 text-[12.5px] font-medium">
            ← Picks
          </Link>
          <h1 className="text-[14px] font-semibold tracking-[-0.011em]">
            {LEAGUE_NAME} <span className="text-[var(--ink-faint)]">· slate</span>
          </h1>
          <span className="nums ml-auto text-[12px] text-[var(--ink-faint)]">Week {week}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 pb-16 pt-4 lg:px-6">
        <div className="no-scrollbar mb-3 flex gap-1 overflow-x-auto">
          {current.weeks.map((w) => (
            <Link
              key={w.week}
              href={`/admin?week=${w.week}${key ? `&key=${key}` : ""}`}
              className={`nums grid h-7 min-w-[28px] shrink-0 place-items-center rounded-[7px] px-1.5 text-[12.5px] font-medium transition-colors ${
                w.week === week
                  ? "bg-white/[0.09] font-semibold text-[var(--ink)]"
                  : "text-[var(--ink-faint)] hover:bg-white/[0.045] hover:text-[var(--ink-dim)]"
              }`}
            >
              {w.week}
            </Link>
          ))}
        </div>

        <SlateEditor season={season} week={week} candidates={candidates} />
      </main>
    </>
  );
}
