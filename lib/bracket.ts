/**
 * The College Football Playoff bracket: structure, resolution and scoring.
 *
 * Pure functions over a seeded field — no database, no ESPN — so the whole
 * thing is testable against a season that already happened.
 *
 * Twelve teams. Seeds 1 to 4 sit out the first round; 5 through 12 play in.
 * The shape is fixed: the top seed gets whoever survives 8 v 9, and the
 * semifinals keep the 1/4 side of the bracket away from the 2/3 side until the
 * final. Verified against the 2025 season — Indiana as the 1 seed played 9 seed
 * Alabama in a quarterfinal, and Miami as the 10 seed reached the final.
 */
import { BRACKET_ROUND_POINTS, BRACKET_UPSET_BONUS_PER_SEED } from "./config";

export type Round = "r1" | "qf" | "sf" | "final";

export type SlotId =
  | "r1a"
  | "r1b"
  | "r1c"
  | "r1d"
  | "qf1"
  | "qf2"
  | "qf3"
  | "qf4"
  | "sf1"
  | "sf2"
  | "final";

/** Where a side of a matchup comes from: a seed outright, or an earlier slot. */
export type Source = { kind: "seed"; seed: number } | { kind: "slot"; slot: SlotId };

export interface SlotDef {
  id: SlotId;
  round: Round;
  /** Short label for the matchup, e.g. "5 v 12" or "1 v 8/9". */
  label: string;
  sources: [Source, Source];
}

const seed = (n: number): Source => ({ kind: "seed", seed: n });
const from = (slot: SlotId): Source => ({ kind: "slot", slot });

export const SLOTS: SlotDef[] = [
  { id: "r1a", round: "r1", label: "5 v 12", sources: [seed(5), seed(12)] },
  { id: "r1b", round: "r1", label: "6 v 11", sources: [seed(6), seed(11)] },
  { id: "r1c", round: "r1", label: "7 v 10", sources: [seed(7), seed(10)] },
  { id: "r1d", round: "r1", label: "8 v 9", sources: [seed(8), seed(9)] },

  { id: "qf1", round: "qf", label: "1 v 8/9", sources: [seed(1), from("r1d")] },
  { id: "qf2", round: "qf", label: "2 v 7/10", sources: [seed(2), from("r1c")] },
  { id: "qf3", round: "qf", label: "3 v 6/11", sources: [seed(3), from("r1b")] },
  { id: "qf4", round: "qf", label: "4 v 5/12", sources: [seed(4), from("r1a")] },

  { id: "sf1", round: "sf", label: "Semifinal", sources: [from("qf1"), from("qf4")] },
  { id: "sf2", round: "sf", label: "Semifinal", sources: [from("qf2"), from("qf3")] },

  { id: "final", round: "final", label: "National championship", sources: [from("sf1"), from("sf2")] },
];

export const SLOT_IDS = SLOTS.map((s) => s.id);
export const ROUND_ORDER: Round[] = ["r1", "qf", "sf", "final"];

export const ROUND_NAMES: Record<Round, string> = {
  r1: "First round",
  qf: "Quarterfinals",
  sf: "Semifinals",
  final: "National championship",
};

export function isSlotId(value: string): value is SlotId {
  return (SLOT_IDS as string[]).includes(value);
}

export interface BracketTeam {
  seed: number;
  teamId: string;
  name: string;
  short: string;
  abbr: string;
  logo: string | null;
  color: string | null;
}

/** A player's bracket, or the real results: slot → winning team id. */
export type Winners = Partial<Record<SlotId, string | null>>;

export interface ResolvedSlot {
  def: SlotDef;
  /** The two teams in this matchup, null while an earlier slot is undecided. */
  a: BracketTeam | null;
  b: BracketTeam | null;
  /** The chosen winner, if it's one of the two teams above. */
  winner: BracketTeam | null;
}

/**
 * Walk the bracket with a set of winners, working out who is in each matchup.
 *
 * Used for a player's picks and for the real results alike — the difference is
 * only where the winners came from. A winner that isn't actually in its
 * matchup is ignored rather than trusted, so a stale pick left behind by an
 * upstream change can't put a knocked-out team in a later round.
 */
export function resolveBracket(field: BracketTeam[], winners: Winners): ResolvedSlot[] {
  const bySeed = new Map(field.map((t) => [t.seed, t]));
  const byId = new Map(field.map((t) => [t.teamId, t]));
  const resolved = new Map<SlotId, ResolvedSlot>();

  // SLOTS is in dependency order, so one pass is enough.
  for (const def of SLOTS) {
    const sideOf = (s: Source): BracketTeam | null =>
      s.kind === "seed" ? (bySeed.get(s.seed) ?? null) : (resolved.get(s.slot)?.winner ?? null);

    const a = sideOf(def.sources[0]);
    const b = sideOf(def.sources[1]);

    const wanted = winners[def.id] ?? null;
    const picked = wanted ? (byId.get(wanted) ?? null) : null;
    const winner = picked && (picked.teamId === a?.teamId || picked.teamId === b?.teamId) ? picked : null;

    resolved.set(def.id, { def, a, b, winner });
  }

  return SLOTS.map((def) => resolved.get(def.id)!);
}

/** The two teams a player can choose between in one slot, given their bracket. */
export function choicesFor(
  field: BracketTeam[],
  winners: Winners,
  slot: SlotId,
): BracketTeam[] {
  const r = resolveBracket(field, winners).find((x) => x.def.id === slot);
  return [r?.a, r?.b].filter((t): t is BracketTeam => Boolean(t));
}

/**
 * Drop picks that no longer belong — a team knocked out upstream can't still be
 * winning downstream. Called after every change so a bracket is always
 * internally consistent.
 */
export function pruneBracket(field: BracketTeam[], winners: Winners): Winners {
  const out: Winners = {};
  // Re-resolving as we go means a cleared slot cascades to the ones after it.
  for (const r of resolveBracket(field, out)) {
    const wanted = winners[r.def.id] ?? null;
    if (!wanted) continue;
    const legal = choicesFor(field, out, r.def.id).some((t) => t.teamId === wanted);
    if (legal) out[r.def.id] = wanted;
  }
  return out;
}

/**
 * Fill the gaps in a bracket with chalk — the better seed advancing — keeping
 * every pick already made.
 *
 * Each slot is resolved against the bracket as it stands, not a snapshot from
 * the start: chalk for "4 v 5/12" depends on who this bracket already has
 * surviving that first-round game, so filling has to happen in order.
 */
export function completeWithChalk(field: BracketTeam[], picks: Winners = {}): Winners {
  const out: Winners = { ...pruneBracket(field, picks) };
  for (const def of SLOTS) {
    if (out[def.id]) continue;
    const two = choicesFor(field, out, def.id);
    if (two.length !== 2) continue;
    out[def.id] = (two[0].seed < two[1].seed ? two[0] : two[1]).teamId;
  }
  return out;
}

/** Every higher seed wins — the default bracket, and what a no-show gets. */
export function chalkBracket(field: BracketTeam[]): Winners {
  return completeWithChalk(field, {});
}

export interface SlotScore {
  slot: SlotId;
  round: Round;
  /** What they picked, whether or not it turned out. */
  pick: BracketTeam | null;
  /** Who actually won, once the game is played. */
  actual: BracketTeam | null;
  correct: boolean;
  points: number;
  /** Seeds beaten: the bonus half of a correct upset call. */
  upsetBonus: number;
}

export interface BracketScore {
  points: number;
  correct: number;
  /** Slots that have actually been decided. */
  decided: number;
  /** Points still reachable from undecided slots, ignoring upset bonuses. */
  remaining: number;
  slots: SlotScore[];
}

/**
 * Score a bracket against the real results.
 *
 * Rounds double: 1, 2, 4, 8. On top of that a correct call pays the seed
 * difference when the lower seed won, so picking a 12 to beat a 5 is worth
 * seven more than picking the 5 — the bonus is for calling the upset, not for
 * owning the underdog, so a wrong pick earns nothing either way.
 */
export function scoreBracket(
  field: BracketTeam[],
  picks: Winners,
  results: Winners,
): BracketScore {
  const mine = resolveBracket(field, picks);
  const real = resolveBracket(field, results);

  let points = 0;
  let correct = 0;
  let decided = 0;
  let remaining = 0;

  const slots = SLOTS.map((def, i): SlotScore => {
    const pick = mine[i].winner;
    const actual = real[i].winner;
    const base = BRACKET_ROUND_POINTS[def.round];

    if (!actual) {
      remaining += base;
      return { slot: def.id, round: def.round, pick, actual: null, correct: false, points: 0, upsetBonus: 0 };
    }

    decided++;
    const hit = Boolean(pick && pick.teamId === actual.teamId);
    if (!hit) {
      return { slot: def.id, round: def.round, pick, actual, correct: false, points: 0, upsetBonus: 0 };
    }

    // The team that lost this game, for the seed difference.
    const other = real[i].a?.teamId === actual.teamId ? real[i].b : real[i].a;
    const upsetBonus =
      other && actual.seed > other.seed
        ? (actual.seed - other.seed) * BRACKET_UPSET_BONUS_PER_SEED
        : 0;

    correct++;
    points += base + upsetBonus;
    return { slot: def.id, round: def.round, pick, actual, correct: true, points: base + upsetBonus, upsetBonus };
  });

  return { points, correct, decided, remaining, slots };
}

/** How many of the eleven games they've called. A full bracket is 11. */
export function bracketFilled(field: BracketTeam[], picks: Winners): number {
  return resolveBracket(field, picks).filter((r) => r.winner).length;
}
