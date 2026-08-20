import { Fragment } from "react";
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
import { Countdown } from "@/components/Countdown";
import { dayKey, dayLabel } from "@/lib/format";
import type { GameView } from "@/lib/view-types";
import { getBoard, getPlayerBySlug, getPlayers, getSeasonStandings, getSlateChange } from "@/lib/queries";
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

  // If the slate moved after they picked, say so rather than letting a pick
  // quietly stop counting.
  const slateChange = meId === null ? null : await getSlateChange(season, week, meId);

  const made = meId === null ? 0 : board.filter((g) => g.picks.some((p) => p.playerId === meId)).length;
  const openGames = board.filter((g) => !g.locked).length;
  const anyLive = board.some((g) => g.status === "in" || (!g.completed && g.locked));

  // The next game that hasn't kicked off, for the countdown.
  const upcoming = board.filter((g) => !g.locked).sort((a, b) => a.kickoff - b.kickoff)[0];
  const nextKickoff = upcoming
    ? { kickoff: upcoming.kickoff, label: `${upcoming.away.abbr} @ ${upcoming.home.abbr}` }
    : null;

  return (
    <>
      <LiveRefresh active={anyLive} />

      <header className="glass sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-2.5 lg:px-6">
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

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-4 lg:px-6 lg:pt-5">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
          <div className="min-w-0">
            {board.length === 0 ? (
              <EmptyWeek week={week} />
            ) : (
              <>
                {meId === null && (
                  <p className="mb-3 px-0.5 text-[12px] text-[var(--ink-faint)]">
                    Browsing as a guest — choose your name, top right, to pick.
                  </p>
                )}

                {slateChange && slateChange.dropped.length > 0 && (
                  <div
                    role="status"
                    className="mb-3 rounded-[var(--r-card)] border px-3 py-2.5 text-[12.5px] leading-relaxed"
                    style={{
                      borderColor: "color-mix(in srgb, var(--push) 45%, transparent)",
                      background: "color-mix(in srgb, var(--push) 10%, transparent)",
                    }}
                  >
                    <strong className="font-semibold">The slate changed.</strong>{" "}
                    {slateChange.dropped.join(", ")}{" "}
                    {slateChange.dropped.length === 1 ? "is" : "are"} no longer in this
                    week, so your pick{slateChange.dropped.length === 1 ? "" : "s"} there
                    {slateChange.dropped.length === 1 ? " doesn’t" : " don’t"} count.
                    {slateChange.needsPick > 0 ? (
                      <>
                        {" "}
                        You have{" "}
                        <strong className="font-semibold">
                          {slateChange.needsPick} game{slateChange.needsPick === 1 ? "" : "s"}
                        </strong>{" "}
                        left to pick.
                      </>
                    ) : (
                      " Everything else is picked."
                    )}
                  </div>
                )}
                {nextKickoff && (
                  <div className="lg:hidden">
                    <Countdown kickoff={nextKickoff.kickoff} label={nextKickoff.label} />
                  </div>
                )}
                <div className="grid gap-2.5 lg:grid-cols-2">
                  {groupByDay(board).map((group) => (
                    <Fragment key={group.key}>
                      {/* Day headings organise the phone's single column. From lg
                          they're hidden, so cards flow across two columns and a
                          day with one game can't strand an empty half-row — each
                          card carries its own day instead. */}
                      <div className="col-span-full mt-3 mb-1 flex items-baseline gap-2.5 first:mt-0 lg:hidden">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-dim)]">
                          {group.label}
                        </h2>
                        <span className="nums text-[11px] text-[var(--ink-faint)]">
                          {group.games.length}
                        </span>
                        <span className="h-px flex-1 bg-[var(--line)]" />
                      </div>
                      {group.games.map((game, i) => (
                        <GameCard
                          key={game.id}
                          game={game}
                          players={players}
                          meId={meId}
                          index={group.offset + i}
                        />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </>
            )}

            <p className="mt-6 text-[11.5px] leading-relaxed text-[var(--ink-faint)]">
              Lines from DraftKings via ESPN. Picks lock at each game&apos;s kickoff and are
              graded against the spread as it stood at that moment.
            </p>
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h)+1.25rem)]">
            {nextKickoff && (
              <div className="hidden lg:block [&>div]:mb-0">
                <Countdown kickoff={nextKickoff.kickoff} label={nextKickoff.label} />
              </div>
            )}
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
  const groups: Array<{ key: string; label: string; offset: number; games: GameView[] }> = [];
  for (const [i, game] of games.entries()) {
    const key = dayKey(game.kickoff);
    const last = groups.at(-1);
    if (last?.key === key) last.games.push(game);
    // offset is the game's position across the whole slate, so the entrance
    // stagger keeps running across day headings instead of restarting.
    else groups.push({ key, label: dayLabel(game.kickoff), offset: i, games: [game] });
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
