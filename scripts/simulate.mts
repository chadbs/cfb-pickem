/**
 * End-to-end simulation against real, already-played games.
 *
 * The scenario this exists to prove: we store a slate with a live line, the
 * games kick off and finish, ESPN removes the odds entirely — and we can still
 * grade the week because the closing line was frozen at kickoff.
 *
 *   npx tsx scripts/simulate.mts
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, ready, schema } from "../lib/db";
import { fetchWeek } from "../lib/espn";
import { syncWeek } from "../lib/sync";
import { getBoard, getSeasonStandings } from "../lib/queries";

const SEASON = 2025;
const WEEK = 5;
const { games, picks } = schema;

let failures = 0;
const check = (label: string, cond: boolean, extra = "") => {
  if (!cond) failures++;
  console.log(`${cond ? "  ok  " : " FAIL "} ${label}${extra ? "  " + extra : ""}`);
};

async function cleanup() {
  const rows = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.season, SEASON), eq(games.week, WEEK)));
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await db.delete(picks).where(inArray(picks.gameId, ids));
    await db.delete(games).where(inArray(games.id, ids));
  }
}

await ready();
await cleanup();

// ---------------------------------------------------------------- 1. set up
const espn = await fetchWeek(SEASON, WEEK);
const finals = espn.filter((g) => g.completed && g.home.score !== null && g.away.score !== null).slice(0, 10);
console.log(`Fetched ${espn.length} games from ${SEASON} week ${WEEK}; using ${finals.length} finals.`);
check("ESPN really did drop the odds on these finals", finals.every((g) => g.spread === null));

/**
 * Choose each line relative to the actual result so the outcome is known in
 * advance: adjusted margin ends up exactly equal to `offset`, so the home side
 * covers when offset > 0 and it's a push at 0.
 */
const OFFSETS = [3, -3, 0, 7, -7, 1.5, -1.5, 10, -10, 0.5];
const now = Date.now();

const expected: Array<{ espnId: string; offset: number; homeResult: "win" | "loss" | "push" }> = [];

for (const [i, g] of finals.entries()) {
  const offset = OFFSETS[i];
  const margin = g.home.score! - g.away.score!;
  const spread = -margin + offset;

  // Insert as it would have looked *before* kickoff: line known, no score,
  // nothing locked yet.
  await db.insert(games).values({
    espnId: g.espnId,
    season: SEASON,
    week: WEEK,
    seasonType: 2,
    kickoff: g.kickoff,
    homeTeamId: g.home.teamId,
    homeName: g.home.name,
    homeShort: g.home.short,
    homeAbbr: g.home.abbr,
    homeLogo: g.home.logo,
    homeColor: g.home.color,
    homeRank: g.home.rank,
    homeRecord: g.home.record,
    homeScore: null,
    awayTeamId: g.away.teamId,
    awayName: g.away.name,
    awayShort: g.away.short,
    awayAbbr: g.away.abbr,
    awayLogo: g.away.logo,
    awayColor: g.away.color,
    awayRank: g.away.rank,
    awayRecord: g.away.record,
    awayScore: null,
    neutralSite: g.neutralSite,
    venue: g.venue,
    broadcast: g.broadcast,
    spread,
    lockedSpread: null,
    overUnder: g.overUnder,
    oddsProvider: "test",
    status: "pre",
    statusDetail: null,
    period: null,
    clock: null,
    completed: false,
    isSelected: true,
    selectionRank: i + 1,
    selectionScore: 0,
    selectionReason: "simulation",
    manualPin: false,
    updatedAt: now,
  });

  expected.push({
    espnId: g.espnId,
    offset,
    homeResult: offset > 0 ? "win" : offset < 0 ? "loss" : "push",
  });
}

// ------------------------------------------------------------- 2. make picks
const stored = await db
  .select()
  .from(games)
  .where(and(eq(games.season, SEASON), eq(games.week, WEEK)))
  .orderBy(games.selectionRank);

// Darren takes every home side, Chad every away side, Jake alternates,
// Eric goes home on even slots. Gives every result type across the board.
const strategies: Record<number, (i: number) => "home" | "away"> = {
  1: () => "home",
  2: () => "away",
  3: (i) => (i % 2 === 0 ? "home" : "away"),
  4: (i) => (i % 2 === 0 ? "home" : "away"),
};

for (const [i, row] of stored.entries()) {
  for (const playerId of [1, 2, 3, 4]) {
    await db.insert(picks).values({
      playerId,
      gameId: row.id,
      side: strategies[playerId](i),
      spreadAtPick: row.spread,
      createdAt: now,
      updatedAt: now,
    });
  }
}
console.log(`Inserted ${stored.length * 4} picks.\n`);

// --------------------------------------------- 3. the games play out (sync)
const result = await syncWeek(SEASON, WEEK);
console.log("sync:", result, "\n");
check("sync locked a line for every game", result.locked === stored.length, `locked=${result.locked}`);
check("sync did not reshuffle a slate that has picks", result.created === 0);

const board = await getBoard(SEASON, WEEK);

check("every game came back final", board.every((g) => g.completed));
check("every game kept a locked line", board.every((g) => g.lockedSpread !== null));
check(
  "the locked line is exactly the one we stored pregame, not a null from ESPN",
  board.every((g) => {
    const pregame = stored.find((s) => s.id === g.id)!;
    return g.lockedSpread === pregame.spread;
  }),
);

// ------------------------------------------------------------- 4. the grades
console.log("Results:");
let gradedRight = 0;
for (const g of board) {
  const stored_ = stored.find((s) => s.id === g.id)!;
  const exp = expected.find((e) => e.espnId === stored_.espnId)!;
  const homePick = g.picks.find((p) => p.playerId === 1)!;
  const awayPick = g.picks.find((p) => p.playerId === 2)!;

  const homeOk = homePick.result === exp.homeResult;
  const awayOk =
    awayPick.result === (exp.homeResult === "push" ? "push" : exp.homeResult === "win" ? "loss" : "win");
  if (homeOk && awayOk) gradedRight++;

  console.log(
    `  ${homeOk && awayOk ? "ok  " : "FAIL"} ${g.away.abbr.padEnd(6)}@${g.home.abbr.padEnd(6)} ` +
      `${String(g.away.score).padStart(3)}-${String(g.home.score).padEnd(3)} ` +
      `line=${String(g.lockedSpread).padStart(6)} adj=${String(exp.offset).padStart(5)} ` +
      `home=${homePick.result?.padEnd(5)} away=${awayPick.result}`,
  );
}
check("every game graded exactly as predicted", gradedRight === board.length, `${gradedRight}/${board.length}`);

// -------------------------------------------------------- 5. the leaderboard
const { standings } = await getSeasonStandings(SEASON);
console.log("\nStandings:");
for (const s of standings) {
  console.log(
    `  ${s.player.name.padEnd(7)} ${s.wins}-${s.losses}-${s.pushes}  ` +
      `pts=${String(s.points).padEnd(4)} pct=${(s.pct * 100).toFixed(1)}%  weekWins=${s.weekWins} streak=${s.streak}`,
  );
}

const homeWins = expected.filter((e) => e.homeResult === "win").length;
const homeLosses = expected.filter((e) => e.homeResult === "loss").length;
const pushes = expected.filter((e) => e.homeResult === "push").length;

const darren = standings.find((s) => s.player.slug === "darren")!;
const chad = standings.find((s) => s.player.slug === "chad")!;
check("all-home record matches the slate", darren.wins === homeWins && darren.losses === homeLosses, `${darren.wins}-${darren.losses}`);
check("all-away record is the exact mirror", chad.wins === homeLosses && chad.losses === homeWins, `${chad.wins}-${chad.losses}`);
check("pushes counted, not dropped", darren.pushes === pushes && chad.pushes === pushes);
check("points = wins + half a push", darren.points === darren.wins + darren.pushes * 0.5);
check("every pick was graded (nothing left pending)", standings.every((s) => s.pending === 0));
check("exactly one outright week winner", standings.filter((s) => s.weekWins === 1).length <= 1);

// ------------------------------------------------- 6. line movement, end to end
// The whole point of storing spread_at_pick: two people can take the same team
// at different numbers, and each has to be settled at their own.
console.log("\n=== Line movement ===");
{
  const target = board[0];
  const margin = target.home.score! - target.away.score!;
  await db.delete(picks).where(eq(picks.gameId, target.id));

  // Both on the home side; one took a number that covers, one that doesn't.
  await db.insert(picks).values({
    playerId: 1, gameId: target.id, side: "home",
    spreadAtPick: -margin + 3, createdAt: now, updatedAt: now,
  });
  await db.insert(picks).values({
    playerId: 2, gameId: target.id, side: "home",
    spreadAtPick: -margin - 3, createdAt: now, updatedAt: now,
  });

  const [again] = await getBoard(SEASON, WEEK).then((b) => b.filter((x) => x.id === target.id));
  const early = again.picks.find((p) => p.playerId === 1)!;
  const late = again.picks.find((p) => p.playerId === 2)!;

  console.log(
    `  ${again.away.abbr} @ ${again.home.abbr} ${again.away.score}-${again.home.score} ` +
      `(closing ${again.lockedSpread}) → P1 took ${early.lockedAt} = ${early.result}, ` +
      `P2 took ${late.lockedAt} = ${late.result}`,
  );
  check("same side, better number → win", early.result === "win");
  check("same side, worse number → loss", late.result === "loss");
  check("each pick reports the number it was taken at", early.lockedAt !== late.lockedAt);
  // early's number happens to equal the closing line here, so it must NOT be
  // flagged; late's differs and must be. Checks the flag in both directions.
  check("a pick sitting on the closing number is not flagged", !early.lineMoved);
  check("a pick at a different number is flagged for the UI", late.lineMoved);

  const { standings: s2 } = await getSeasonStandings(SEASON);
  const p1 = s2.find((s) => s.player.id === 1)!;
  const p2 = s2.find((s) => s.player.id === 2)!;
  check("the leaderboard settles at each player's own number too", p1.wins !== p2.wins || p1.losses !== p2.losses);
}

await cleanup();
console.log(`\n${failures === 0 ? "SIMULATION PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
