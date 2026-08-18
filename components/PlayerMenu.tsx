"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { selectPlayer } from "@/app/actions";
import type { PlayerView } from "@/lib/view-types";

/**
 * Identity control. There are no accounts — you say who you are and the browser
 * remembers it. Whoever is selected here is the only person whose picks this
 * device can change; everyone else's stay visible but read-only.
 */
export function PlayerMenu({ players, meId }: { players: PlayerView[]; meId: number | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<number | null>(meId);
  const wrapRef = useRef<HTMLDivElement>(null);

  const activeId = local ?? meId;
  const me = players.find((p) => p.id === activeId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(p: PlayerView) {
    setLocal(p.id);
    setOpen(false);
    startTransition(async () => {
      await selectPlayer(p.slug);
      router.refresh();
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="ctl flex h-8 items-center gap-2 pl-1.5 pr-2"
        style={
          me
            ? {
                borderColor: `color-mix(in srgb, ${me.accent} 34%, transparent)`,
                background: `color-mix(in srgb, ${me.accent} 9%, var(--card-bg))`,
              }
            : { borderColor: "color-mix(in srgb, var(--brand) 50%, transparent)" }
        }
      >
        {me ? (
          <>
            <span
              className="grid h-[21px] w-[21px] place-items-center rounded-full text-[10px] font-semibold"
              style={{
                background: `color-mix(in srgb, ${me.accent} 22%, transparent)`,
                color: me.accent,
                border: `1px solid color-mix(in srgb, ${me.accent} 45%, transparent)`,
              }}
            >
              {me.initials}
            </span>
            <span className="hidden text-[13px] font-medium text-[var(--ink)] sm:inline">
              {me.name}
            </span>
          </>
        ) : (
          <span className="px-1 text-[13px] font-medium text-[var(--ink)]">Who are you?</span>
        )}
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="menu-in absolute right-0 z-50 mt-2 w-[228px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--bg-elev)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]"
        >
          <p className="px-3 pb-1.5 pt-2.5 text-[11px] font-medium text-[var(--ink-faint)]">
            Picking as
          </p>

          {players.map((p) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => choose(p)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.045]"
              >
                <span
                  className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: `color-mix(in srgb, ${p.accent} 20%, transparent)`,
                    color: p.accent,
                    border: `1px solid color-mix(in srgb, ${p.accent} 42%, transparent)`,
                  }}
                >
                  {p.initials}
                </span>
                <span
                  className={`flex-1 text-[13px] ${isActive ? "font-medium text-[var(--ink)]" : "text-[var(--ink-dim)]"}`}
                >
                  {p.name}
                </span>
                {isActive && <Check />}
              </button>
            );
          })}

          <p className="mt-1 border-t border-[var(--line)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-faint)]">
            You can see everyone&apos;s picks. You can only change your own.
          </p>
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3 w-3 shrink-0 text-[var(--ink-faint)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0 text-[var(--ink-dim)]"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
