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

  // Before anything is graded a full table is four rows of em-dashes taking up
  // the top of a phone screen. A single row of faces says the same thing.
  if (!played) {
    return (
      <section className="card flex items-center gap-3 px-3 py-2.5">
        <div className="flex -space-x-1.5">
          {standings.map((s) => (
            <span key={s.player.id} className="ring-2 ring-[var(--card-bg)] rounded-full">
              <Avatar player={s.player} size={24} isMe={s.player.id === meId} />
            </span>
          ))}
        </div>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-faint)]">
          Four players · nothing graded yet
        </span>
        <Link
          href="/standings"
          className="shrink-0 text-[11.5px] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-dim)]"
        >
          Table
        </Link>
      </section>
    );
  }

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
              <span className="nums w-3 shrink-0 text-[11px] text-[var(--ink-faint)]">{i + 1}</span>
              <Avatar player={s.player} size={22} isMe={isMe} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink)]">
                {s.player.name}
              </span>
              {s.streak !== 0 && (
                <span
                  className="nums text-[10.5px] font-medium"
                  style={{ color: s.streak > 0 ? "var(--win)" : "var(--loss)" }}
                >
                  {s.streak > 0 ? `W${s.streak}` : `L${-s.streak}`}
                </span>
              )}
              <span className="nums w-[46px] shrink-0 text-right text-[12.5px] font-semibold text-[var(--ink)]">
                {recordLine(s.wins, s.losses, s.pushes)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
