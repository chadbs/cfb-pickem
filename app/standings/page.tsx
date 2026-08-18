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
      <header className="glass sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 pb-2.5 pt-2.5">
          <Link
            href="/"
            className="rounded-lg bg-white/[0.07] px-2 py-1 text-[11.5px] font-medium text-[var(--ink-dim)] transition-colors hover:text-[var(--ink)]"
          >
            ← Picks
          </Link>
          <h1 className="text-[15px] font-bold tracking-tight">{LEAGUE_NAME}</h1>
          <span className="nums ml-auto text-[11.5px] text-[var(--ink-faint)]">
            {current.season} season
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-3 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-3">
        {!played ? (
          <div className="card flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="text-2xl">📊</span>
            <p className="text-[14px] font-semibold">Nothing graded yet</p>
            <p className="max-w-[17rem] text-[12px] leading-relaxed text-[var(--ink-faint)]">
              Standings fill in as games go final. Make your picks and check back
              Saturday night.
            </p>
          </div>
        ) : (
          <>
            <section className="card mb-3 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wider text-[var(--ink-faint)]">
                    <th className="px-3 py-2 font-semibold">Player</th>
                    <th className="nums px-1 py-2 text-right font-semibold">Rec</th>
                    <th className="nums px-1 py-2 text-right font-semibold">Pts</th>
                    <th className="nums px-1 py-2 text-right font-semibold">Win%</th>
                    <th className="nums px-3 py-2 text-right font-semibold">Wks</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr
                      key={s.player.id}
                      className="border-t border-[var(--line)]"
                      style={{
                        background:
                          i === 0 ? `color-mix(in srgb, ${s.player.accent} 8%, transparent)` : undefined,
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="nums w-3 text-[11px] text-[var(--ink-faint)]">{i + 1}</span>
                          <Avatar player={s.player} size={24} />
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-semibold leading-tight">
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
                      <td className="nums px-1 py-2.5 text-right text-[13px]">{s.points}</td>
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
              <h2 className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                Week by week
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-left">
                  <thead>
                    <tr className="text-[10.5px] text-[var(--ink-faint)]">
                      <th className="px-3 py-2 font-semibold">Wk</th>
                      {standings.map((s) => (
                        <th key={s.player.id} className="px-1 py-2 text-center font-semibold">
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
                                  color: isBest ? s.player.accent : "var(--ink-dim)",
                                  fontWeight: isBest ? 700 : 400,
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
          </>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--ink-faint)]">
          A win is 1 point, a push is ½. &ldquo;Wks&rdquo; counts outright weekly wins.
        </p>
      </main>
    </>
  );
}
