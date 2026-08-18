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
  title,
}: {
  player: PlayerView;
  size?: number;
  result?: PickResult | null;
  isMe?: boolean;
  title?: string;
}) {
  const ring = result ? RESULT_RING[result] : player.accent;
  return (
    <span
      title={title ?? player.name}
      aria-label={player.name}
      className="inline-grid place-items-center rounded-full font-semibold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.44,
        color: player.accent,
        background: `color-mix(in srgb, ${player.accent} 18%, transparent)`,
        border: `1.5px solid ${ring}`,
        boxShadow: isMe ? `0 0 0 2px color-mix(in srgb, ${player.accent} 30%, transparent)` : undefined,
      }}
    >
      {player.initials}
    </span>
  );
}
