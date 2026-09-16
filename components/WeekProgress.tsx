import type { PickResult } from "@/lib/scoring";
import type { PlayerView } from "@/lib/view-types";

const LOCK_TONE: Record<PickResult, string> = {
  win: "var(--win)",
  loss: "var(--loss)",
  push: "var(--push)",
};

export function WeekProgress({
  me,
  made,
  total,
  open,
  lock,
}: {
  me: PlayerView | null;
  made: number;
  total: number;
  /** Games not yet kicked off — i.e. still changeable. */
  open: number;
  /** Their lock of the week: the game, or null if they haven't called one. */
  lock: { label: string; result: PickResult | null; auto: boolean } | null;
}) {
  if (!me || total === 0) return null;

  const missed = total - made - open;
  const complete = made === total;

  return (
    <section className="card px-3 py-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
          Your week
        </h2>
        <span className="nums text-[12.5px] font-semibold text-[var(--ink)]">
          {made}
          <span className="text-[var(--ink-faint)]">/{total}</span>
        </span>
      </div>

      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="flex-1 rounded-full"
            style={{ background: i < made ? me.accent : "var(--line-strong)" }}
          />
        ))}
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--ink-faint)]">
        {complete
          ? "All picks in."
          : open > 0
            ? `${total - made} left · ${open} still open`
            : "Picks are closed for this week."}
        {missed > 0 && !complete && (
          <span className="text-[var(--loss)]"> · {missed} missed</span>
        )}
      </p>

      {/* The lock is easy to forget and worth two points, so it gets a line of
          its own rather than living only on whichever card holds it. */}
      <p className="mt-1.5 flex items-baseline gap-1.5 border-t border-[var(--line)] pt-2 text-[11.5px]">
        <span className="text-[var(--ink-faint)]">Lock</span>
        {lock ? (
          <span
            className="min-w-0 truncate font-medium"
            style={{ color: lock.result ? LOCK_TONE[lock.result] : "var(--ink)" }}
          >
            {lock.label}
            {lock.result === "win" ? " · hit" : lock.result === "loss" ? " · missed" : ""}
            {lock.auto && !lock.result && (
              <span className="font-normal text-[var(--ink-faint)]"> · default</span>
            )}
          </span>
        ) : (
          <span className="text-[var(--ink-faint)]">
            {open > 0 ? "not set — defaults to your team" : "none this week"}
          </span>
        )}
      </p>
    </section>
  );
}
