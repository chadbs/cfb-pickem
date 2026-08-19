"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const TABS = [
  { href: "/" as const, label: "Picks", icon: BallIcon },
  { href: "/standings" as const, label: "Standings", icon: TrophyIcon },
  { href: "/insights" as const, label: "Insights", icon: ChartIcon },
];

const SPRING = { type: "spring" as const, stiffness: 480, damping: 38 };

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

/** Inline pills beside the brand. Desktop only — the phone gets a bottom bar. */
export function SiteTabs() {
  const isActive = useActive();
  return (
    <nav className="hidden items-center gap-0.5 lg:flex">
      {TABS.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-[7px] px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
              active ? "text-[var(--ink)]" : "text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
            }`}
          >
            {active && (
              // Shared id: the highlight travels between tabs instead of
              // disappearing here and reappearing there.
              <motion.span
                layoutId="tab-pill"
                transition={SPRING}
                className="absolute inset-0 rounded-[7px] bg-white/[0.09]"
              />
            )}
            <span className="relative">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Fixed bottom bar on phones. Standings and Insights were previously reachable
 * only through a small link inside a card, which is not somewhere anyone looks.
 */
export function BottomNav() {
  const isActive = useActive();
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = isActive(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors"
              style={{ color: active ? "var(--ink)" : "var(--ink-faint)" }}
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-bar"
                  transition={SPRING}
                  className="absolute inset-x-5 top-0 h-[2px] rounded-full"
                  style={{ background: "var(--brand)" }}
                />
              )}
              <motion.span
                animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}
                transition={SPRING}
              >
                <Icon active={active} />
              </motion.span>
              <span className="text-[10.5px] font-medium">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[18px] w-[18px]",
};

function BallIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps} strokeWidth={active ? 2.3 : 1.9}>
      <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-45 12 12)" />
      <path d="M9.5 14.5 14.5 9.5M10.5 11.5l2 2M13 9l2 2" />
    </svg>
  );
}

function TrophyIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps} strokeWidth={active ? 2.3 : 1.9}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      <path d="M12 14v4M9 20h6" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps} strokeWidth={active ? 2.3 : 1.9}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="m7 14 3.5-3.5 3 3L21 6" />
    </svg>
  );
}
