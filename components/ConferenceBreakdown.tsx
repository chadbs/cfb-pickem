"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CONFERENCE_SPOTLIGHT } from "@/lib/config";
import type { ATS, ConferenceBreakdown as Breakdown, WL } from "@/lib/conferences";

function suLabel(r: WL) {
  return r.wins + r.losses === 0 ? "—" : `${r.wins}-${r.losses}`;
}

function atsLabel(r: ATS) {
  const n = r.wins + r.losses + r.pushes;
  if (n === 0) return "—";
  return r.pushes ? `${r.wins}-${r.losses}-${r.pushes}` : `${r.wins}-${r.losses}`;
}

/** Green above .500, red below, quiet when even or empty. */
function tone(wins: number, losses: number): string {
  if (wins === losses) return wins === 0 ? "var(--ink-faint)" : "var(--ink-dim)";
  return wins > losses ? "var(--win)" : "var(--loss)";
}

export function ConferenceBreakdown({ breakdowns }: { breakdowns: Breakdown[] }) {
  // The named four and the ACC lead; the rest keep the server's weight order.
  const ordered = useMemo(() => {
    const spot = CONFERENCE_SPOTLIGHT.map((id) => breakdowns.find((b) => b.id === id)).filter(
      (b): b is Breakdown => Boolean(b),
    );
    return [...spot, ...breakdowns.filter((b) => !CONFERENCE_SPOTLIGHT.includes(b.id))];
  }, [breakdowns]);

  const [selected, setSelected] = useState(ordered[0]?.id ?? "");
  const current = ordered.find((b) => b.id === selected) ?? ordered[0];
  if (!current) return null;

  const { vsFbs, vsFcs } = current;
  const fbsGames = vsFbs.su.wins + vsFbs.su.losses;

  return (
    <section className="card overflow-hidden lg:col-span-2">
      <div className="border-b border-[var(--line)] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
          Conference vs conference
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
          Straight up and against the spread, non-conference games only
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Conference"
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-[var(--line)] px-2 py-2"
      >
        {ordered.map((b) => {
          const active = b.id === current.id;
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(b.id)}
              className={`relative shrink-0 rounded-[7px] px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                active ? "text-[var(--ink)]" : "text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="conf-tab"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  className="absolute inset-0 rounded-[7px] bg-white/[0.09]"
                />
              )}
              <span className="relative">{b.name}</span>
            </button>
          );
        })}
      </div>

      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* The headline numbers for the selected league. */}
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-3 py-2.5">
          <span className="text-[14px] font-semibold">{current.name}</span>
          <Stat label="vs FBS" value={suLabel(vsFbs.su)} color={tone(vsFbs.su.wins, vsFbs.su.losses)} />
          <Stat label="ATS" value={atsLabel(vsFbs.ats)} color={tone(vsFbs.ats.wins, vsFbs.ats.losses)} />
          <Stat label="vs FCS" value={suLabel(vsFcs.su)} color={tone(vsFcs.su.wins, vsFcs.su.losses)} />
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="border-t border-[var(--line)] text-[10.5px] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
              <th className="px-3 py-1.5 font-medium">Against</th>
              <th className="nums px-2 py-1.5 text-right font-medium">Straight up</th>
              <th className="nums px-3 py-1.5 text-right font-medium">ATS</th>
            </tr>
          </thead>
          <tbody>
            {current.lines.map((l) => {
              const played = l.su.wins + l.su.losses > 0;
              return (
                <tr
                  key={l.opp}
                  className={`border-t border-[var(--line)] ${l.opp === "fcs" ? "bg-white/[0.02]" : ""}`}
                  style={{ opacity: played ? 1 : 0.45 }}
                >
                  <td className="px-3 py-2 text-[12.5px] font-medium">{l.oppName}</td>
                  <td
                    className="nums px-2 py-2 text-right text-[13px] font-semibold"
                    style={{ color: tone(l.su.wins, l.su.losses) }}
                  >
                    {suLabel(l.su)}
                  </td>
                  <td
                    className="nums px-3 py-2 text-right text-[12.5px]"
                    style={{ color: tone(l.ats.wins, l.ats.losses) }}
                  >
                    {atsLabel(l.ats)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-faint)]">
          {fbsGames === 0
            ? `${current.name} hasn't finished a game against another FBS conference yet.`
            : "Every other conference is listed, including pairings that haven't happened yet. FCS opponents share one row."}
        </p>
      </motion.div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="text-[12px]">
      <span className="mr-1.5 text-[10.5px] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
        {label}
      </span>
      <span className="nums font-semibold" style={{ color }}>
        {value}
      </span>
    </span>
  );
}
