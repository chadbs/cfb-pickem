import { AUTO_PICK_BIG_FAVORITE } from "./config";
import type { Side } from "./scoring";

/**
 * Which side to take for someone who never picked.
 *
 * No edge is being claimed here. A point spread exists precisely to split the
 * action, so any rule lands near 50% and the honest goal is to be consistent,
 * explainable, and never to leave a slot empty.
 *
 * The rule, given a home-relative line:
 *   - a favourite laying 14 or more is treated as inflated, so take the dog
 *   - otherwise take the home side, which covers the home underdog and the
 *     modest home favourite, the steadier side of a short number
 *   - with no line at all, take the home side for home advantage
 *
 * Deterministic on purpose: everyone who misses the same game gets the same
 * side, so an auto-pick can never quietly advantage one player over another.
 */
export function autoPickSide(homeSpread: number | null): Side {
  if (homeSpread === null) return "home";
  if (Math.abs(homeSpread) >= AUTO_PICK_BIG_FAVORITE) {
    // Negative means the home team is favoured, so the dog is the away side.
    return homeSpread < 0 ? "away" : "home";
  }
  return "home";
}

/** Short human explanation, for the UI. */
export function autoPickReason(homeSpread: number | null): string {
  if (homeSpread === null) return "no line was posted, so the home side";
  if (Math.abs(homeSpread) >= AUTO_PICK_BIG_FAVORITE) return "took the underdog off a big number";
  return "took the home side";
}
