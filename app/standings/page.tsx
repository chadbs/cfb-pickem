import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { LEAGUE_NAME } from "@/lib/config";
import { formatRecord, recordLine } from "@/lib/format";
import { getSeasonStandings } from "@/lib/queries";
import { getCurrentWeek } from "@/lib/sync";

export const dynamic = "force-dynamic";

export default async function Standings() {
  const current = await getCurrentWeek();
  const { standings, weekly } = await getSeasonStandings(current.season);

  const played = standings.some((s) => s.wins + s.losses + s.pushes > 0);

  return (
    <>
      <header className="glass sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-3 px-4 py-2.5 lg:px-6">
          <Link href="/" className="ctl flex h-8 items-center gap-1.5 px-2.5 text-[12.5px] font-medium">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Picks
          </Link>
          <h1 className="text-[14px] font-semibold tracking-[-0.011em]">{LEAGUE_NAME}</h1>
          <span className="nums ml-auto text-[12px] text-[var(--ink-faint)]">
            {current.season} season
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pb-16 pt-4 lg:px-6 lg:pt-5">
        {!played ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="text-2xl">📊</span>
            <p className="text-[14px] font-semibold">Nothing graded yet</p>
            <p className="max-w-[21rem] text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
              Standings fill in as games go final. Make your picks and check back
              Saturday night.
            </p>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <h2 className="border-b border-[var(--line)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
                Season
              </h2>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                    <th className="px-3 py-1.5 font-medium">Player</th>
                    <th className="nums px-1 py-1.5 text-right font-medium">Rec</th>
                    <th className="nums px-1 py-1.5 text-right font-medium">Pts</th>
                    <th className="nums px-1 py-1.5 text-right font-medium">Win%</th>
                    <th className="nums px-3 py-1.5 text-right font-medium">Wks</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.player.id} className="border-t border-[var(--line)]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="nums w-3 text-[11px] text-[var(--ink-faint)]">{i + 1}</span>
                          <Avatar player={s.player} size={24} />
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium leading-tight">
                              {s.player.name}
                            </div>
                            {s.streak !== 0 && (
                              <div
                                className="nums text-[10.5px] leading-tight"
                                style={{ color: s.streak > 0 ? "var(--win)" : "var(--loss)" }}
                              >
                                {s.streak > 0 ? `W${s.streak}` : `L${-s.streak}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="nums px-1 py-2.5 text-right text-[13px] font-semibold">
                        {recordLine(s.wins, s.losses, s.pushes)}
                      </td>
                      <td className="nums px-1 py-2.5 text-right text-[13px] text-[var(--ink-dim)]">
                        {s.points}
                      </td>
                      <td className="nums px-1 py-2.5 text-right text-[13px] text-[var(--ink-dim)]">
                        {formatRecord(s.pct)}
                      </td>
                      <td className="nums px-3 py-2.5 text-right text-[13px] text-[var(--push)]">
                        {s.weekWins || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card overflow-hidden">
              <h2 className="border-b border-[var(--line)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
                Week by week
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[19rem] text-left">
                  <thead>
                    <tr className="text-[10.5px] text-[var(--ink-faint)]">
                      <th className="px-3 py-1.5 font-medium">Wk</th>
                      {standings.map((s) => (
                        <th key={s.player.id} className="px-1 py-1.5 text-center font-semibold">
                          <span style={{ color: s.player.accent }}>{s.player.initials}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekly.map((w) => {
                      const best = Math.max(
                        0,
                        ...standings.map((s) => w.byPlayer[s.player.id]?.points ?? 0),
                      );
                      return (
                        <tr key={w.week} className="border-t border-[var(--line)]">
                          <td className="nums px-3 py-2 text-[12px] text-[var(--ink-dim)]">{w.week}</td>
                          {standings.map((s) => {
                            const line = w.byPlayer[s.player.id];
                            const isBest = line && best > 0 && line.points === best;
                            return (
                              <td
                                key={s.player.id}
                                className="nums px-1 py-2 text-center text-[12px]"
                                style={{
                                  color: isBest ? s.player.accent : "var(--ink-faint)",
                                  fontWeight: isBest ? 600 : 400,
                                }}
                              >
                                {line ? recordLine(line.wins, line.losses, line.pushes) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <p className="mt-6 text-[11.5px] leading-relaxed text-[var(--ink-faint)]">
          A win is 1 point, a push is ½. &ldquo;Wks&rdquo; counts outright weekly wins.
        </p>
      </main>
    </>
  );
}
