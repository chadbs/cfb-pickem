import Link from "next/link";
import { cookies } from "next/headers";
import { GameCard } from "@/components/GameCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PlayerMenu } from "@/components/PlayerMenu";
import { RefreshButton } from "@/components/RefreshButton";
import { SiteTabs } from "@/components/SiteNav";
import { StandingsPanel } from "@/components/StandingsPanel";
import { WeekNav } from "@/components/WeekNav";
import { WeekProgress } from "@/components/WeekProgress";
import { LEAGUE_NAME } from "@/lib/config";
import { dayKey, dayLabel } from "@/lib/format";
import type { GameView } from "@/lib/view-types";
import { getBoard, getPlayerBySlug, getPlayers, getSeasonStandings } from "@/lib/queries";
import { getCurrentWeek, maybeSyncWeek } from "@/lib/sync";

// Live scores and kickoff locks make every render time-sensitive.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const current = await getCurrentWeek();

  const raw = Array.isArray(sp.week) ? sp.week[0] : sp.week;
  const asked = Number(raw);
  const week = Number.isInteger(asked) && asked >= 1 && asked <= 20 ? asked : current.week;
  const season = current.season;

  // Refreshes scores/lines if stale. Cheap and throttled; safe on every load.
  await maybeSyncWeek(season, week);

  const [board, players, standings] = await Promise.all([
    getBoard(season, week),
    getPlayers(),
    getSeasonStandings(season),
  ]);

  const slug = (await cookies()).get("pickem_player")?.value;
  const me = slug ? await getPlayerBySlug(slug) : null;
  const meId = me?.id ?? null;

  const made = meId === null ? 0 : board.filter((g) => g.picks.some((p) => p.playerId === meId)).length;
  const openGames = board.filter((g) => !g.locked).length;
  const anyLive = board.some((g) => g.status === "in" || (!g.completed && g.locked));

  return (
    <>
      <LiveRefresh active={anyLive} />

      <header className="glass sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-2.5 lg:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="order-1 flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] text-[12px]"
                style={{ background: "color-mix(in srgb, var(--brand) 22%, transparent)" }}
              >
                🏈
              </span>
              <h1 className="truncate text-[14px] font-semibold tracking-[-0.011em]">
                {LEAGUE_NAME}
              </h1>
              <span className="nums hidden rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink-dim)] sm:inline lg:hidden xl:inline">
                Week {week}
              </span>
              {week !== current.week && (
                <Link
                  href="/"
                  className="shrink-0 text-[11.5px] font-medium text-[var(--brand)] hover:underline"
                >
                  Today
                </Link>
              )}
              <span className="ml-1 hidden lg:block">
                <SiteTabs />
              </span>
            </div>

            <div className="order-2 ml-auto flex shrink-0 items-center gap-2 lg:order-3 lg:ml-0">
              <Link
                href={`/admin?week=${week}`}
                title="Edit this week's games"
                aria-label="Edit this week's games"
                className="ctl grid h-8 w-8 place-items-center"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[14px] w-[14px]"
                >
                  <path d="M3 6h18M3 12h18M3 18h18" />
                  <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
                  <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
                </svg>
              </Link>
              <RefreshButton season={season} week={week} />
              <PlayerMenu players={players} meId={meId} />
            </div>

            {/* Wraps to its own row on phones, sits inline between the brand and
                the controls from lg up. */}
            <div className="order-3 w-full min-w-0 lg:order-2 lg:ml-3 lg:w-auto lg:flex-1">
              <WeekNav weeks={current.weeks.map((w) => w.week)} week={week} currentWeek={current.week} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-16 pt-4 lg:px-6 lg:pt-5">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-6">
          <div className="order-2 min-w-0 lg:order-1">
            {board.length === 0 ? (
              <EmptyWeek week={week} />
            ) : (
              <>
                {meId === null && (
                  <div
                    className="mb-3 rounded-[var(--r-card)] border px-3 py-2.5 text-[12.5px] leading-relaxed"
                    style={{
                      borderColor: "color-mix(in srgb, var(--brand) 32%, transparent)",
                      background: "color-mix(in srgb, var(--brand) 8%, transparent)",
                    }}
                  >
                    Pick who you are in the top right to start making picks. You can
                    browse everyone else&apos;s in the meantime.
                  </div>
                )}
                <div className="space-y-5">
                  {groupByDay(board).map((group) => (
                    <section key={group.key}>
                      <div className="mb-2 flex items-baseline gap-2.5">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-dim)]">
                          {group.label}
                        </h2>
                        <span className="nums text-[11px] text-[var(--ink-faint)]">
                          {group.games.length}
                        </span>
                        <span className="h-px flex-1 bg-[var(--line)]" />
                      </div>
                      <div className="grid gap-3 xl:grid-cols-2">
                        {group.games.map((game) => (
                          <GameCard key={game.id} game={game} players={players} meId={meId} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}

            <p className="mt-6 text-[11.5px] leading-relaxed text-[var(--ink-faint)]">
              Lines from DraftKings via ESPN. Picks lock at each game&apos;s kickoff and are
              graded against the spread as it stood at that moment.
            </p>
          </div>

          <aside className="order-1 flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h)+1.25rem)] lg:order-2">
            <StandingsPanel standings={standings.standings} meId={meId} />
            <WeekProgress me={me} made={made} total={board.length} open={openGames} />
          </aside>
        </div>
      </main>
    </>
  );
}

/** Ten games spread across Thursday to Sunday read as one pile without this. */
function groupByDay(games: GameView[]) {
  const groups: Array<{ key: string; label: string; games: GameView[] }> = [];
  for (const game of games) {
    const key = dayKey(game.kickoff);
    const last = groups.at(-1);
    if (last?.key === key) last.games.push(game);
    else groups.push({ key, label: dayLabel(game.kickoff), games: [game] });
  }
  return groups;
}

function EmptyWeek({ week }: { week: number }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="text-2xl">🏈</span>
      <p className="text-[14px] font-semibold">No slate for week {week} yet</p>
      <p className="max-w-[20rem] text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
        Games are chosen automatically once ESPN posts the schedule and the books
        put up lines. Check back closer to the weekend.
      </p>
    </div>
  );
}
