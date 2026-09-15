"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { setLine } from "@/app/actions";
import type { LineView } from "@/lib/view-types";

type Fav = "away" | "home" | "pk";

/** "NEB -24.5" — how people actually say a line, rather than home-relative maths. */
function lineLabel(line: number | null, g: LineView): string {
  if (line === null) return "no line";
  if (line === 0) return "PK";
  return line < 0 ? `${g.homeAbbr} ${line}` : `${g.awayAbbr} -${line}`;
}

export function LineEditor({ games }: { games: LineView[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const missing = games.filter((g) => g.line === null && !g.started).length;

  if (games.length === 0) return null;

  return (
    <section className="card mb-4 overflow-hidden">
      <div className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--line)] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
          Lines
        </h2>
        {missing > 0 ? (
          <span className="text-[11.5px] font-medium text-[var(--push)]">
            {missing} game{missing === 1 ? " has" : "s have"} no line — {missing === 1 ? "it" : "they"}
            {" "}would grade as a pick&apos;em
          </span>
        ) : (
          <span className="text-[11.5px] text-[var(--ink-faint)]">
            From ESPN unless you set one. Frozen at kickoff.
          </span>
        )}
      </div>

      <ul>
        {games.map((g) => (
          <LineRow
            key={g.id}
            g={g}
            open={open === g.id}
            onToggle={() => setOpen((cur) => (cur === g.id ? null : g.id))}
            onDone={() => setOpen(null)}
          />
        ))}
      </ul>
    </section>
  );
}

function LineRow({
  g,
  open,
  onToggle,
  onDone,
}: {
  g: LineView;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const noLine = g.line === null && !g.started;
  const source = g.manualSpread !== null ? "set by you" : g.line !== null ? (g.oddsProvider ?? "ESPN") : null;

  return (
    <li className="border-t border-[var(--line)] first:border-t-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <Logo src={g.awayLogo} />
          <span className="truncate text-[13px] font-semibold">
            <span className="sm:hidden">{g.awayAbbr}</span>
            <span className="hidden sm:inline">{g.awayShort}</span>
          </span>
          <span className="shrink-0 text-[10.5px] text-[var(--ink-faint)]">{g.neutralSite ? "vs" : "@"}</span>
          <Logo src={g.homeLogo} />
          <span className="truncate text-[13px] font-semibold">
            <span className="sm:hidden">{g.homeAbbr}</span>
            <span className="hidden sm:inline">{g.homeShort}</span>
          </span>
        </span>

        {source && (
          <span className="hidden shrink-0 text-[11px] text-[var(--ink-faint)] sm:inline">{source}</span>
        )}

        <span
          className="nums shrink-0 rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold"
          style={
            noLine
              ? { color: "var(--push)", background: "color-mix(in srgb, var(--push) 13%, transparent)" }
              : g.manualSpread !== null
                ? { color: "var(--brand)", background: "color-mix(in srgb, var(--brand) 13%, transparent)" }
                : { color: "var(--ink-dim)" }
          }
        >
          {lineLabel(g.line, g)}
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="ctl h-7 shrink-0 px-2 text-[12px] font-medium"
        >
          {open ? "Close" : noLine ? "Set" : "Edit"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <LineForm g={g} onDone={onDone} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function LineForm({ g, onDone }: { g: LineView; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Start from whatever is on the board, so a small tweak is a small edit.
  const start = g.line;
  const [fav, setFav] = useState<Fav>(start === null ? "home" : start === 0 ? "pk" : start < 0 ? "home" : "away");
  const [points, setPoints] = useState(start === null || start === 0 ? "" : String(Math.abs(start)));

  function save(value: number | null) {
    setError(null);
    startTransition(async () => {
      const res = await setLine(g.id, value);
      if (!res.ok) {
        setError(res.error ?? "Could not save");
        return;
      }
      onDone();
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (fav === "pk") return save(0);
    const n = Number(points);
    if (!points.trim() || !Number.isFinite(n) || n <= 0) {
      setError("Enter how many points the favorite is giving");
      return;
    }
    // Stored home-relative: a home favorite is negative.
    save(fav === "home" ? -n : n);
  }

  const options: Array<[Fav, string]> = [
    ["away", g.awayAbbr],
    ["home", g.homeAbbr],
    ["pk", "Pick'em"],
  ];

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 px-3 pb-3">
      <span className="text-[11.5px] text-[var(--ink-faint)]">Favorite</span>
      <div role="radiogroup" aria-label="Favorite" className="ctl flex h-8 items-center p-0.5">
        {options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={fav === value}
            onClick={() => setFav(value)}
            className={`h-full rounded-[6px] px-2.5 text-[12px] font-medium transition-colors ${
              fav === value ? "bg-white/[0.09] text-[var(--ink)]" : "text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {fav !== "pk" && (
        <label className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-[var(--ink-faint)]">by</span>
          <input
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            inputMode="decimal"
            type="number"
            min={0.5}
            max={70}
            step={0.5}
            placeholder="24.5"
            autoFocus
            className="ctl nums h-8 w-[76px] px-2 text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
          />
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-[var(--r-ctl)] px-3 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ background: "var(--brand)" }}
      >
        {pending ? "Saving…" : "Save line"}
      </button>

      {g.manualSpread !== null && !g.started && (
        <button
          type="button"
          onClick={() => save(null)}
          disabled={pending}
          className="text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink-dim)] disabled:opacity-40"
        >
          Use ESPN&apos;s{g.espnSpread !== null ? ` (${lineLabel(g.espnSpread, g)})` : ""}
        </button>
      )}

      <p className="w-full text-[11px] leading-relaxed text-[var(--ink-faint)]">
        {g.started
          ? "Already kicked off — saving replaces the closing line and regrades every pick on this game."
          : g.manualSpread !== null && g.espnSpread !== null
            ? `ESPN currently has ${lineLabel(g.espnSpread, g)}. Yours stays until you switch back.`
            : "Everyone's pick on this game grades against this number. It stays even if ESPN posts one later."}
      </p>
      {error && <p className="w-full text-[11.5px] text-[var(--loss)]">{error}</p>}
    </form>
  );
}

function Logo({ src }: { src: string | null }) {
  if (!src) return <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-white/5" />;
  return (
    <Image src={src} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0 object-contain" unoptimized />
  );
}
