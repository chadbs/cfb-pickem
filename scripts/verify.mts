/**
 * Engine smoke test. Run with: npx tsx scripts/verify.ts
 * Exercises spread derivation, slate selection, ATS grading and a real sync.
 */
import { fetchCurrentWeek, fetchWeek, deriveHomeSpread } from "../lib/espn";
import { selectWeek, isFavorite } from "../lib/selection";
import { gradePick, coverMargin, buildLeaderboard, spreadForPick } from "../lib/scoring";
import type { Game, Player } from "../lib/db/schema";

let failures = 0;
function check(label: string, cond: boolean, extra = "") {
  if (!cond) failures++;
  console.log(`${cond ? "  ok  " : " FAIL "} ${label}${extra ? "  " + extra : ""}`);
}

// ---------------------------------------------------------------- 1. spreads
console.log("\n=== 1. Home-relative spread derivation ===");
type Odds = Parameters<typeof deriveHomeSpread>[0];
const cases: Array<[string, Odds, string, string, number | null]> = [
  [
    "home favored",
    { details: "TCU -7.5", spread: -7.5, homeTeamOdds: { favorite: true, team: { abbreviation: "TCU" } }, awayTeamOdds: { favorite: false, team: { abbreviation: "UNC" } } },
    "TCU", "UNC", -7.5,
  ],
  [
    "away favored (ESPN's raw sign flips here)",
    { details: "MIZ -7", spread: 7, homeTeamOdds: { favorite: false, team: { abbreviation: "KU" } }, awayTeamOdds: { favorite: true, team: { abbreviation: "MIZ" } } },
    "KU", "MIZ", 7,
  ],
  ["pick'em", { details: "EVEN", spread: 0 }, "AAA", "BBB", 0],
  ["PK", { details: "PK" }, "AAA", "BBB", 0],
  [
    "unparseable details falls back to favorite flag",
    { details: "some junk", spread: -3, homeTeamOdds: { favorite: false }, awayTeamOdds: { favorite: true } },
    "AAA", "BBB", 3,
  ],
  ["no odds at all", null, "AAA", "BBB", null],
];
for (const [label, odds, h, a, want] of cases) {
  const got = deriveHomeSpread(odds, h, a);
  check(label, got === want, `got ${got}, want ${want}`);
}

// ---------------------------------------------------------------- 2. grading
console.log("\n=== 2. ATS grading ===");
const g = (homeScore: number, awayScore: number, lockedSpread: number) =>
  ({ completed: true, homeScore, awayScore, lockedSpread, spread: null }) as unknown as Game;

check("home -7.5 wins by 10 -> home covers", gradePick(g(30, 20, -7.5), "home") === "win");
check("home -7.5 wins by 10 -> away loses", gradePick(g(30, 20, -7.5), "away") === "loss");
check("home -7.5 wins by 3 -> home fails to cover", gradePick(g(23, 20, -7.5), "home") === "loss");
check("away -7 (home +7) loses by 4 -> home covers", gradePick(g(24, 28, 7), "home") === "win");
check("exact number is a push", gradePick(g(27, 20, -7), "home") === "push");
check("push is a push both ways", gradePick(g(27, 20, -7), "away") === "push");
check("underdog outright win covers", gradePick(g(20, 30, -3), "away") === "win");
check("unfinished game is ungraded", gradePick({ ...g(0, 0, -3), completed: false } as Game, "home") === null);
check("cover margin is signed correctly", coverMargin(g(30, 20, -7.5), "home") === 2.5);
check("live spread used when no locked line yet",
  gradePick({ completed: true, homeScore: 30, awayScore: 20, lockedSpread: null, spread: -7.5 } as Game, "home") === "win");

// --------------------------------------------- 2b. per-pick line locking
// Everyone is settled at the number they personally took, so two people on the
// same side of the same game can get opposite results when the line moved.
console.log("\n=== 2b. Per-pick line locking ===");
const moved = g(28, 23, -10); // home won by 5; the line closed at -10
check("closing line alone would be a loss", gradePick(moved, "home") === "loss");
check("someone who took -3 earlier wins", gradePick(moved, "home", -3) === "win");
check("someone who took -7 earlier loses", gradePick(moved, "home", -7) === "loss");
check("someone who took the exact margin pushes", gradePick(moved, "home", -5) === "push");
check("an override of 0 counts as a pick'em, not as missing",
  gradePick(g(24, 24, -7), "home", 0) === "push");
check("no override still falls back to the game's line", gradePick(moved, "home") === "loss");
check("the other side mirrors at that same number", gradePick(moved, "away", -3) === "loss");

check("spreadForPick prefers the number the player took",
  spreadForPick({ lockedSpread: -10, spread: -9 } as Game, -3) === -3);
check("spreadForPick keeps a legitimate 0",
  spreadForPick({ lockedSpread: -10, spread: null } as Game, 0) === 0);
check("spreadForPick falls back when the pick has no number",
  spreadForPick({ lockedSpread: -10, spread: null } as Game, null) === -10);

// ------------------------------------------------------------ 3. leaderboard
console.log("\n=== 3. Leaderboard ===");
const mkPlayer = (id: number, name: string): Player =>
  ({ id, slug: name.toLowerCase(), name, accent: "#fff", initials: name[0], sort: id, createdAt: 0 });
const roster = [mkPlayer(1, "Darren"), mkPlayer(2, "Chad")];
const lb = buildLeaderboard(roster, [
  { playerId: 1, week: 1, kickoff: 1, result: "win" },
  { playerId: 1, week: 1, kickoff: 2, result: "win" },
  { playerId: 1, week: 1, kickoff: 3, result: "push" },
  { playerId: 2, week: 1, kickoff: 1, result: "win" },
  { playerId: 2, week: 1, kickoff: 2, result: "loss" },
  { playerId: 2, week: 1, kickoff: 3, result: null },
]);
check("leader sorted first", lb[0].player.name === "Darren", `-> ${lb[0].player.name}`);
check("points: 2 wins + 1 push = 2.5", lb[0].points === 2.5, `-> ${lb[0].points}`);
check("pending picks counted", lb[1].pending === 1, `-> ${lb[1].pending}`);
check("outright week win credited", lb[0].weekWins === 1, `-> ${lb[0].weekWins}`);
check("no week win for runner-up", lb[1].weekWins === 0);
check("win streak tracked", lb[0].streak === 2, `-> ${lb[0].streak}`);

// -------------------------------------------------------- 4. live ESPN data
console.log("\n=== 4. Live ESPN fetch ===");
const cur = await fetchCurrentWeek();
console.log(`  current: ${cur.season} week ${cur.week} (${cur.weeks.length} weeks in calendar)`);
check("season looks sane", cur.season >= 2025 && cur.season <= 2030);
check("week calendar populated", cur.weeks.length >= 14);

const week = await fetchWeek(cur.season, cur.week);
console.log(`  fetched ${week.length} FBS games for week ${cur.week}`);
check("games returned", week.length > 20);
const withLines = week.filter((x) => x.spread !== null);
console.log(`  ${withLines.length} have a posted line`);

// Every derived spread must agree with the string ESPN printed.
let mismatches = 0;
for (const x of withLines) {
  const favAbbr = x.spread! < 0 ? x.home.abbr : x.spread! > 0 ? x.away.abbr : null;
  if (favAbbr === null) continue;
  if (Math.abs(x.spread!) > 60) mismatches++;
}
check("no absurd spreads", mismatches === 0, `${mismatches} bad`);

// --------------------------------------------------------- 5. slate selection
console.log("\n=== 5. Slate selection ===");
const slate = selectWeek(week);
check("exactly 10 games selected", slate.length === 10, `-> ${slate.length}`);
console.log("");
for (const s of slate) {
  const fav = isFavorite(s.game);
  const sp = s.game.spread;
  const line = sp === null ? "no line" : sp === 0 ? "PK" : sp < 0 ? `${s.game.home.abbr} ${sp}` : `${s.game.away.abbr} -${sp}`;
  console.log(
    `  ${fav ? "*" : " "} ${String(Math.round(s.score)).padStart(5)}  ` +
      `${(s.game.away.rank ? "#" + s.game.away.rank + " " : "") + s.game.away.abbr}`.padEnd(12) +
      ` @ ${((s.game.home.rank ? "#" + s.game.home.rank + " " : "") + s.game.home.abbr)}`.padEnd(14) +
      `  ${line.padEnd(12)} ${new Date(s.game.kickoff).toISOString().slice(5, 16)}  ${s.reason}`,
  );
}
const favsInWeek = week.filter(isFavorite);
const favsSelected = slate.filter((s) => isFavorite(s.game));
console.log(`\n  favorite-team games this week: ${favsInWeek.length}, selected: ${favsSelected.length}`);
for (const f of favsInWeek) console.log(`    - ${f.away.abbr} @ ${f.home.abbr} (${isFavorite(f)})`);
check(
  "every favorite-team game made the slate",
  favsSelected.length === Math.min(favsInWeek.length, 10),
);
check("slate is in kickoff order", slate.every((s, i) => i === 0 || slate[i - 1].game.kickoff <= s.game.kickoff));

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
