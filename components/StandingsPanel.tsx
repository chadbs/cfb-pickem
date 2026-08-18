import Link from "next/link";
import { Avatar } from "./Avatar";
import { recordLine } from "@/lib/format";
import type { StandingView } from "@/lib/view-types";

export function StandingsPanel({
  standings,
  meId,
}: {
  standings: StandingView[];
  meId: number | null;
}) {
  const played = standings.some((s) => s.wins + s.losses + s.pushes > 0);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
          Standings
        </h2>
        <Link
          href="/standings"
          className="text-[11.5px] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-dim)]"
        >
          Full table
        </Link>
      </div>

      <ul>
        {standings.map((s, i) => {
          const isMe = s.player.id === meId;
          return (
            <li
              key={s.player.id}
              className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
              style={
                isMe
                  ? { background: `color-mix(in srgb, ${s.player.accent} 7%, transparent)` }
                  : undefined
              }
            >
              <span className="nums w-3 shrink-0 text-[11px] text-[var(--ink-faint)]">
                {played ? i + 1 : "–"}
              </span>
              <Avatar player={s.player} size={22} isMe={isMe} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink)]">
                {s.player.name}
              </span>
              {s.streak !== 0 && played && (
                <span
                  className="nums text-[10.5px] font-medium"
                  style={{ color: s.streak > 0 ? "var(--win)" : "var(--loss)" }}
                >
                  {s.streak > 0 ? `W${s.streak}` : `L${-s.streak}`}
                </span>
              )}
              <span className="nums w-[46px] shrink-0 text-right text-[12.5px] font-semibold text-[var(--ink)]">
                {played ? recordLine(s.wins, s.losses, s.pushes) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
