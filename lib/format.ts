/** Display helpers shared by server and client components. */

/** "-7.5", "+3.5", "PK". */
export function formatSpread(spread: number | null): string {
  if (spread === null) return "—";
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

/** The spread from one side's perspective, given a home-relative line. */
export function spreadForSide(homeSpread: number | null, side: "home" | "away"): number | null {
  if (homeSpread === null) return null;
  return side === "home" ? homeSpread : -homeSpread;
}

export function formatKickoff(ts: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(ts));
}

export function formatKickoffLong(ts: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(ts));
}

export function formatRecord(pct: number): string {
  return `${Math.round(pct * 1000) / 10}%`;
}

/** "3-1", or "3-1-1" when there are pushes. */
export function recordLine(wins: number, losses: number, pushes: number): string {
  return pushes > 0 ? `${wins}-${losses}-${pushes}` : `${wins}-${losses}`;
}
