import Link from "next/link";
import { cookies } from "next/headers";
import { GameCard } from "@/components/GameCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PlayerSwitcher } from "@/components/PlayerSwitcher";
import { RefreshButton } from "@/components/RefreshButton";
import { StandingsStrip } from "@/components/StandingsStrip";
import { WeekNav } from "@/components/WeekNav";
import { Avatar } from "@/components/Avatar";
import { LEAGUE_NAME, GAMES_PER_WEEK } from "@/lib/config";
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

  const [board, players, season_] = await Promise.all([
    getBoard(season, week),
    getPlayers(),
    getSeasonStandings(season),
  ]);

  const slug = (await cookies()).get("pickem_player")?.value;
  const me = slug ? await getPlayerBySlug(slug) : null;
  const meId = me?.id ?? null;

  const myPicks = meId === null ? 0 : board.filter((g) => g.picks.some((p) => p.playerId === meId)).length;
  const openGames = board.filter((g) => !g.locked).length;
  const anyLive = board.some((g) => g.status === "in" || (!g.completed && g.locked));

  const weekNumbers = current.weeks.map((w) => w.week);

  return (
    <>
      <LiveRefresh active={anyLive} />

      <header className="glass sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-xl px-3 pb-2 pt-2.5">
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-[15px] font-bold tracking-tight">{LEAGUE_NAME}</h1>
            <span className="nums rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ink-dim)]">
              Week {week}
            </span>
            {week !== current.week && (
              <Link
                href="/"
                className="text-[11px] font-medium text-[var(--live)] hover:underline"
              >
                jump to now
              </Link>
            )}
            <div className="ml-auto flex items-center gap-2">
              {me && <Avatar player={me} size={22} isMe />}
              <RefreshButton season={season} week={week} />
              <Link
                href="/standings"
                className="rounded-lg bg-white/[0.07] px-2 py-1 text-[11.5px] font-medium text-[var(--ink-dim)] transition-colors hover:text-[var(--ink)]"
              >
                Standings
              </Link>
            </div>
          </div>

          <WeekNav weeks={weekNumbers} week={week} currentWeek={current.week} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-3 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mb-3 space-y-3">
          <StandingsStrip standings={season_.standings} meId={meId} />

          <div className="card p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                Picking as
              </span>
              {meId !== null && board.length > 0 && (
                <span className="nums text-[11.5px] text-[var(--ink-dim)]">
                  {myPicks}/{board.length} picked
                  {openGames > 0 && myPicks < board.length && (
                    <span className="text-[var(--ink-faint)]"> · {openGames} still open</span>
                  )}
                </span>
              )}
            </div>

            <PlayerSwitcher players={players} meId={meId} />

            {meId === null && (
              <p className="mt-2 px-1 text-[12px] text-[var(--ink-faint)]">
                Tap your name to start picking.
              </p>
            )}

            {meId !== null && board.length > 0 && (
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${(myPicks / board.length) * 100}%`,
                    background: me?.accent ?? "var(--ink-dim)",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {board.length === 0 ? (
          <EmptyWeek week={week} />
        ) : (
          <div className="space-y-2.5">
            {board.map((game) => (
              <GameCard key={game.id} game={game} players={players} meId={meId} />
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--ink-faint)]">
          {GAMES_PER_WEEK} games a week · lines from DraftKings via ESPN
          <br />
          Picks lock at each game&apos;s kickoff. Spread is frozen at kickoff.
        </p>
      </main>
    </>
  );
}

function EmptyWeek({ week }: { week: number }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span className="text-2xl">🏈</span>
      <p className="text-[14px] font-semibold">No slate for week {week} yet</p>
      <p className="max-w-[16rem] text-[12px] leading-relaxed text-[var(--ink-faint)]">
        Games get picked automatically once ESPN posts the schedule. Check back
        closer to the weekend.
      </p>
    </div>
  );
}
