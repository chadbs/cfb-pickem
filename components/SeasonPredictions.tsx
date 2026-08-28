import Image from "next/image";
import { FAVORITE_TEAM_IDS, REGULAR_SEASON_GAMES, SEASON_PREDICTIONS } from "@/lib/config";
import type { TeamRecord } from "@/lib/queries";
import type { PlayerView } from "@/lib/view-types";

/** Games away from a team's real record, once that season is actually over. */
function miss(pred: [number, number] | undefined, team: TeamRecord): number | null {
  if (!pred || team.played < REGULAR_SEASON_GAMES) return null;
  return Math.abs(pred[0] - team.wins);
}

export function SeasonPredictions({
  roster,
  teams,
}: {
  roster: PlayerView[];
  teams: TeamRecord[];
}) {
  // Only players who actually made a call.
  const callers = roster.filter((p) => SEASON_PREDICTIONS[p.slug]);
  if (callers.length === 0 || teams.length === 0) return null;

  const anyPlayed = teams.some((t) => t.played > 0);
  const anyFinished = teams.some((t) => t.played >= REGULAR_SEASON_GAMES);

  // Total games off across every finished team — only meaningful at the end.
  const totals = callers.map((p) => {
    const scored = teams
      .map((t) => miss(SEASON_PREDICTIONS[p.slug]?.[t.teamId], t))
      .filter((n): n is number => n !== null);
    return { player: p, off: scored.reduce((a, b) => a + b, 0), scored: scored.length };
  });
  const bestOff = anyFinished ? Math.min(...totals.map((t) => t.off)) : null;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
          Season predictions
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
          Preseason calls on our four teams
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
              <th className="px-3 py-1.5 font-medium">Team</th>
              <th className="nums px-1 py-1.5 text-center font-medium">Now</th>
              {callers.map((p) => (
                <th key={p.id} className="px-1 py-1.5 text-center font-semibold">
                  <span style={{ color: p.accent }}>{p.initials}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const misses = callers.map((p) => miss(SEASON_PREDICTIONS[p.slug]?.[t.teamId], t));
              const closest = misses.some((m) => m !== null)
                ? Math.min(...misses.filter((m): m is number => m !== null))
                : null;
              return (
                <tr key={t.teamId} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {t.logo ? (
                        <Image
                          src={t.logo}
                          alt=""
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px] shrink-0 object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-white/5" />
                      )}
                      <span className="truncate text-[12.5px] font-medium">
                        {t.name || FAVORITE_TEAM_IDS[t.teamId]}
                      </span>
                    </div>
                  </td>
                  <td className="nums px-1 py-2 text-center text-[12.5px] font-semibold">
                    {t.played > 0 ? `${t.wins}-${t.losses}` : "—"}
                  </td>
                  {callers.map((p, i) => {
                    const pred = SEASON_PREDICTIONS[p.slug]?.[t.teamId];
                    const isClosest = closest !== null && misses[i] === closest;
                    return (
                      <td
                        key={p.id}
                        className="nums px-1 py-2 text-center text-[12.5px]"
                        style={{
                          color: isClosest ? p.accent : "var(--ink-dim)",
                          fontWeight: isClosest ? 700 : 400,
                        }}
                      >
                        {pred ? `${pred[0]}-${pred[1]}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {anyFinished && (
              <tr className="border-t border-[var(--line)] bg-white/[0.02]">
                <td className="px-3 py-2 text-[11px] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                  Games off
                </td>
                <td />
                {totals.map((t) => (
                  <td
                    key={t.player.id}
                    className="nums px-1 py-2 text-center text-[12.5px]"
                    style={{
                      color: t.off === bestOff ? t.player.accent : "var(--ink-dim)",
                      fontWeight: t.off === bestOff ? 700 : 400,
                    }}
                  >
                    {t.off}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-faint)]">
        {anyFinished
          ? `Scored by wins off the real number, once a team has played all ${REGULAR_SEASON_GAMES}.`
          : anyPlayed
            ? `Records update as games finish. Accuracy is scored once a team has played all ${REGULAR_SEASON_GAMES}.`
            : "Nothing played yet — records fill in as the season goes."}
      </p>
    </section>
  );
}
