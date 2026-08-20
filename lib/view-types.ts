/**
 * Serializable shapes handed to client components. Deliberately free of any
 * server imports so the client bundle never pulls in the database layer.
 */
import type { PickResult, Side } from "./scoring";

export interface TeamView {
  teamId: string;
  name: string;
  short: string;
  abbr: string;
  logo: string | null;
  color: string | null;
  rank: number | null;
  record: string | null;
  score: number | null;
}

export interface GamePick {
  playerId: number;
  side: Side;
  result: PickResult | null;
  /** In-progress game where this side is currently covering. */
  liveCovering: boolean;
  /**
   * The home-relative line this pick is graded at — the number that was showing
   * when it was made. Two people on the same side can hold different numbers.
   */
  lockedAt: number | null;
  /** True when this pick's number differs from the game's current/closing line. */
  lineMoved: boolean;
}

export interface GameView {
  id: number;
  season: number;
  week: number;
  kickoff: number;
  home: TeamView;
  away: TeamView;
  neutralSite: boolean;
  venue: string | null;
  broadcast: string | null;
  /** Home-relative live line. */
  spread: number | null;
  /** Home-relative line frozen at kickoff — what picks are graded against. */
  lockedSpread: number | null;
  /** lockedSpread ?? spread — the number to display and grade with. */
  gradingSpread: number | null;
  overUnder: number | null;
  status: "pre" | "in" | "post";
  statusDetail: string | null;
  period: number | null;
  clock: string | null;
  completed: boolean;
  /** Kickoff has passed; picks are frozen. */
  locked: boolean;
  covering: Side | "push" | null;
  selectionReason: string | null;
  picks: GamePick[];
}

/** A game offered to the admin when hand-editing a week's slate. */
export interface CandidateView {
  espnId: string;
  kickoff: number;
  awayAbbr: string;
  homeAbbr: string;
  awayName: string;
  homeName: string;
  awayLogo: string | null;
  homeLogo: string | null;
  awayRank: number | null;
  homeRank: number | null;
  neutralSite: boolean;
  spread: number | null;
  broadcast: string | null;
  /** Auto-picker score, for showing why a game ranks where it does. */
  score: number;
  reason: string;
  favorite: string | null;
  /** Involves one of the conferences the editor shows by default. */
  preferred: boolean;
  /** "Big Ten · ACC", or a single name when both sides share one. */
  confLabel: string;
  selected: boolean;
  /** Would have been chosen automatically. */
  recommended: boolean;
  pickCount: number;
  /** Can't be deselected — someone has picked it, or it has kicked off. */
  locked: boolean;
}

export interface PlayerView {
  id: number;
  slug: string;
  name: string;
  accent: string;
  initials: string;
}

export interface StandingView {
  player: PlayerView;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  points: number;
  pct: number;
  weekWins: number;
  streak: number;
}
