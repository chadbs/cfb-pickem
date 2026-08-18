import Link from "next/link";
import { Avatar } from "./Avatar";
import { recordLine } from "@/lib/format";
import type { StandingView } from "@/lib/view-types";

const MEDAL = ["🥇", "🥈", "🥉"];

export function StandingsStrip({
  standings,
  meId,
}: {
  standings: StandingView[];
  meId: number | null;
}) {
  const anyPlayed = standings.some((s) => s.wins + s.losses + s.pushes > 0);

  return (
    <Link
      href="/standings"
      className="card block p-2.5 transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
          Season standings
        </span>
        <span className="text-[11px] text-[var(--ink-faint)]">Full table →</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {standings.map((s, i) => {
          const isMe = s.player.id === meId;
          return (
            <div
              key={s.player.id}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-2"
              style={{
                background: isMe
                  ? `color-mix(in srgb, ${s.player.accent} 10%, transparent)`
                  : "rgba(255,255,255,0.025)",
              }}
            >
              <span className="h-4 text-[11px] leading-none">
                {anyPlayed && i < 3 ? MEDAL[i] : ""}
              </span>
              <Avatar player={s.player} size={26} isMe={isMe} />
              <span className="max-w-full truncate text-[11.5px] font-medium text-[var(--ink-dim)]">
                {s.player.name}
              </span>
              <span className="nums text-[13px] font-bold leading-none">
                {anyPlayed ? recordLine(s.wins, s.losses, s.pushes) : "—"}
              </span>
              {s.weekWins > 0 && (
                <span className="nums text-[10px] text-[var(--push)]">
                  {s.weekWins}× week
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Link>
  );
}
