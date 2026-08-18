"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { selectPlayer } from "@/app/actions";
import type { PlayerView } from "@/lib/view-types";

/**
 * No accounts — you just say who you are and the browser remembers. Picks are
 * keyed to the player row in the database, so switching devices is fine.
 */
export function PlayerSwitcher({
  players,
  meId,
}: {
  players: PlayerView[];
  meId: number | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [local, setLocal] = useState<number | null>(meId);

  function choose(p: PlayerView) {
    setLocal(p.id);
    startTransition(async () => {
      await selectPlayer(p.slug);
      router.refresh();
    });
  }

  const active = local ?? meId;

  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
      {players.map((p) => {
        const isActive = p.id === active;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p)}
            aria-pressed={isActive}
            className="relative flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors"
            style={{ color: isActive ? p.accent : "var(--ink-faint)" }}
          >
            {isActive && (
              <motion.span
                layoutId="player-pill"
                transition={{ type: "spring", stiffness: 480, damping: 36 }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: `color-mix(in srgb, ${p.accent} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${p.accent} 40%, transparent)`,
                }}
              />
            )}
            <span
              className="relative grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold"
              style={{
                background: `color-mix(in srgb, ${p.accent} 20%, transparent)`,
                color: p.accent,
              }}
            >
              {p.initials}
            </span>
            <span className="relative">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}
