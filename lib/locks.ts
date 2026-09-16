/**
 * Which game becomes someone's lock when they never called one.
 *
 * Pure and deterministic, for the same reason the auto-pick rule is: everyone
 * who forgets should be able to see exactly what they were going to get, and
 * nobody should be able to claim the app chose them a worse game than it chose
 * somebody else.
 */
import { DEFAULT_LOCK_TEAM_IDS, LOCK_FALLBACK_ORDER } from "./config";

export interface LockCandidate {
  id: number;
  kickoff: number;
  homeTeamId: string;
  awayTeamId: string;
}

const byKickoff = (a: LockCandidate, b: LockCandidate) => a.kickoff - b.kickoff || a.id - b.id;

/** Their assigned team, then the other four teams, in a fixed order. */
export function defaultLockTeamOrder(slug: string): string[] {
  const own = DEFAULT_LOCK_TEAM_IDS[slug];
  const rest = LOCK_FALLBACK_ORDER.filter((id) => id !== own);
  return own ? [own, ...rest] : rest;
}

/**
 * The game to lock for `slug`, given the week's slate.
 *
 * Their own team first. Failing that the other home teams in turn — a week
 * without Colorado on the slate still hands Darren someone he has an opinion
 * about. Failing all of those, the week's first kickoff, so the answer is never
 * "no lock".
 */
export function defaultLockGame(slug: string, slate: LockCandidate[]): LockCandidate | null {
  if (slate.length === 0) return null;

  for (const teamId of defaultLockTeamOrder(slug)) {
    const match = slate
      .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
      .sort(byKickoff);
    if (match.length) return match[0];
  }

  return [...slate].sort(byKickoff)[0];
}
