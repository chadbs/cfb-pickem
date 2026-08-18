import type { PlayerView } from "@/lib/view-types";

export function WeekProgress({
  me,
  made,
  total,
  open,
}: {
  me: PlayerView | null;
  made: number;
  total: number;
  /** Games not yet kicked off — i.e. still changeable. */
  open: number;
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
    </section>
  );
}
