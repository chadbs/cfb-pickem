import { CONFERENCE_WEIGHT } from "./config";
import { coveringSide } from "./scoring";

/** Everything outside FBS lands in one bucket — ESPN names FCS leagues individually. */
export const FCS = "fcs";

export interface WL {
  wins: number;
  losses: number;
}

export interface ATS {
  wins: number;
  losses: number;
  pushes: number;
}

export interface ConferenceLine {
  /** ESPN conference id, or FCS. */
  opp: string;
  oppName: string;
  su: WL;
  ats: ATS;
}

export interface ConferenceBreakdown {
  id: string;
  name: string;
  vsFbs: { su: WL; ats: ATS };
  vsFcs: { su: WL; ats: ATS };
  /** One row per other FBS conference, then FCS — always all of them. */
  lines: ConferenceLine[];
}

type GameLike = {
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeConfId: string | null;
  awayConfId: string | null;
  lockedSpread: number | null;
  spread: number | null;
};

const wl = (): WL => ({ wins: 0, losses: 0 });
const ats = (): ATS => ({ wins: 0, losses: 0, pushes: 0 });

/**
 * Every FBS conference's straight-up and against-the-spread record against every
 * other conference, from non-conference games.
 *
 * Built as a full grid rather than "the busiest pairings": every conference gets
 * a row for every other one, including pairings that haven't happened yet, so
 * nothing is silently missing. FCS opponents are counted in their own row —
 * they're most of September for some leagues, and dropping them hid it.
 */
export function buildConferenceBreakdowns(
  games: GameLike[],
  confNames: Record<string, string>,
): ConferenceBreakdown[] {
  const fbs = Object.keys(confNames).sort(
    (a, b) => (CONFERENCE_WEIGHT[b] ?? 0) - (CONFERENCE_WEIGHT[a] ?? 0),
  );
  const isFbs = (id: string | null): id is string => id !== null && id in confNames;

  // grid[conf][opp] -> records
  const grid = new Map<string, Map<string, { su: WL; ats: ATS }>>();
  const cell = (conf: string, opp: string) => {
    let row = grid.get(conf);
    if (!row) grid.set(conf, (row = new Map()));
    let c = row.get(opp);
    if (!c) row.set(opp, (c = { su: wl(), ats: ats() }));
    return c;
  };

  for (const g of games) {
    if (!g.completed || g.homeScore === null || g.awayScore === null) continue;
    if (g.homeScore === g.awayScore) continue; // no ties in college football
    const hc = g.homeConfId;
    const ac = g.awayConfId;
    if (hc === ac) continue; // a league against itself says nothing

    const cover = coveringSide(g);
    const homeWon = g.homeScore > g.awayScore;

    for (const side of ["home", "away"] as const) {
      const mine = side === "home" ? hc : ac;
      const theirs = side === "home" ? ac : hc;
      if (!isFbs(mine)) continue; // only FBS conferences get a breakdown
      const opp = isFbs(theirs) ? theirs : FCS;

      const c = cell(mine, opp);
      const won = side === "home" ? homeWon : !homeWon;
      if (won) c.su.wins++;
      else c.su.losses++;

      // Only games with a line we actually captured count against the spread.
      if (cover === "push") c.ats.pushes++;
      else if (cover === side) c.ats.wins++;
      else if (cover !== null) c.ats.losses++;
    }
  }

  const sum = (cells: Array<{ su: WL; ats: ATS }>) => {
    const out = { su: wl(), ats: ats() };
    for (const c of cells) {
      out.su.wins += c.su.wins;
      out.su.losses += c.su.losses;
      out.ats.wins += c.ats.wins;
      out.ats.losses += c.ats.losses;
      out.ats.pushes += c.ats.pushes;
    }
    return out;
  };

  return fbs.map((id) => {
    const row = grid.get(id) ?? new Map();
    const lines: ConferenceLine[] = [...fbs.filter((o) => o !== id), FCS].map((opp) => {
      const c = row.get(opp) ?? { su: wl(), ats: ats() };
      return { opp, oppName: opp === FCS ? "FCS" : confNames[opp], su: c.su, ats: c.ats };
    });
    return {
      id,
      name: confNames[id],
      vsFbs: sum(lines.filter((l) => l.opp !== FCS)),
      vsFcs: sum(lines.filter((l) => l.opp === FCS)),
      lines,
    };
  });
}
