import type { PickResult } from "@/lib/scoring";
import type { PlayerView } from "@/lib/view-types";

const RESULT_RING: Record<PickResult, string> = {
  win: "var(--win)",
  loss: "var(--loss)",
  push: "var(--push)",
};

export function Avatar({
  player,
  size = 24,
  result = null,
  isMe = false,
  auto = false,
  lock = false,
  title,
}: {
  player: PlayerView;
  size?: number;
  result?: PickResult | null;
  isMe?: boolean;
  /** Auto-filled at kickoff — drawn dashed so it reads as not-chosen. */
  auto?: boolean;
  /** Their lock of the week — gets a badge, since it counts double. */
  lock?: boolean;
  title?: string;
}) {
  const ring = result ? RESULT_RING[result] : player.accent;
  const face = (
    <span
      title={lock ? undefined : (title ?? player.name)}
      aria-label={player.name}
      className="inline-grid place-items-center rounded-full font-semibold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.44,
        color: player.accent,
        background: `color-mix(in srgb, ${player.accent} 18%, transparent)`,
        border: `1.5px ${auto ? "dashed" : "solid"} ${ring}`,
        boxShadow: isMe ? `0 0 0 2px color-mix(in srgb, ${player.accent} 30%, transparent)` : undefined,
      }}
    >
      {player.initials}
    </span>
  );

  if (!lock) return face;

  // A padlock tucked into the corner, on its own background so it stays legible
  // over whatever the avatar is doing underneath.
  return (
    <span
      className="relative inline-grid shrink-0"
      title={title ?? `${player.name} · lock of the week`}
    >
      {face}
      <span
        aria-hidden
        className="absolute -bottom-[3px] -right-[3px] grid place-items-center rounded-full"
        style={{
          width: Math.max(11, size * 0.5),
          height: Math.max(11, size * 0.5),
          background: "var(--push)",
          boxShadow: "0 0 0 1.5px var(--card-bg)",
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#1a1204" strokeWidth="3.2" className="h-[62%] w-[62%]">
          <rect x="4" y="11" width="16" height="10" rx="2" fill="#1a1204" stroke="none" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}
