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
import { autoPickSide } from "../lib/autopick";

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
check("sync locked a line for every slate game", result.locked === stored.length, `locked=${result.locked}`);
check("sync did not reshuffle a slate that has picks", result.reselected === false);
check(
  "sync stored the whole week, not just the slate",
  result.stored > stored.length,
  `stored=${result.stored} slate=${stored.length}`,
);

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

// ------------------------------------ 6. one line settles everyone, end to end
// Two people taking the same team must get the same result even when the
// numbers stored against their picks differ — grading reads the game's
// closing line, not the pick's.
console.log("\n=== One line settles everyone ===");
{
  const target = board[0];
  const margin = target.home.score! - target.away.score!;
  await db.delete(picks).where(eq(picks.gameId, target.id));

  // Deliberately straddling: under the old per-pick rule these two would have
  // been settled on opposite sides of the result.
  await db.insert(picks).values({
    playerId: 1, gameId: target.id, side: "home",
    spreadAtPick: -margin + 3, createdAt: now, updatedAt: now,
  });
  await db.insert(picks).values({
    playerId: 2, gameId: target.id, side: "home",
    spreadAtPick: -margin - 3, createdAt: now, updatedAt: now,
  });

  const [again] = await getBoard(SEASON, WEEK).then((b) => b.filter((x) => x.id === target.id));
  const one = again.picks.find((p) => p.playerId === 1)!;
  const two = again.picks.find((p) => p.playerId === 2)!;

  console.log(
    `  ${again.away.abbr} @ ${again.home.abbr} ${again.away.score}-${again.home.score} ` +
      `closing ${again.lockedSpread} → both settled ${one.result}`,
  );
  check("same side, same result", one.result === two.result);
  check(
    "and it matches the closing line, not either stored number",
    one.result === (margin + (again.lockedSpread ?? 0) > 0 ? "win" : margin + (again.lockedSpread ?? 0) < 0 ? "loss" : "push"),
  );

  // The global invariant, across every game and every player on the board:
  // one side of one game can only ever produce one result.
  const boardNow = await getBoard(SEASON, WEEK);
  const split = boardNow.filter((game) =>
    (["home", "away"] as const).some((sd) => {
      const results = new Set(game.picks.filter((p) => p.side === sd).map((p) => p.result));
      return results.size > 1;
    }),
  );
  check(
    "no game settles two people on the same side differently",
    split.length === 0,
    split.map((game) => `${game.away.abbr}@${game.home.abbr}`).join(", "),
  );
}
// ------------------------------------------ 7. nobody is left without a pick
// The rule the pool depends on: once a game kicks off, every player has a
// pick on it, whether or not they made one.
console.log("\n=== Auto-pick coverage ===");
{
  const target = board[board.length - 1];
  await db.delete(picks).where(eq(picks.gameId, target.id));
  const before = await db.select().from(picks).where(eq(picks.gameId, target.id));
  check("cleared the game to simulate nobody picking", before.length === 0);

  const after = await syncWeek(SEASON, WEEK);
  check("sync reports what it filled", after.autoPicked >= 4, `autoPicked=${after.autoPicked}`);

  const filled = await db.select().from(picks).where(eq(picks.gameId, target.id));
  const roster = await db.select().from(schema.players);
  check(
    "every player now has a pick on it",
    filled.length === roster.length,
    `${filled.length} of ${roster.length}`,
  );
  check("all of them are flagged auto", filled.every((p) => p.auto));

  const expectedSide = autoPickSide(target.lockedSpread ?? target.spread ?? null);
  check(
    "all took the side the rule dictates",
    filled.every((p) => p.side === expectedSide),
    `expected ${expectedSide}`,
  );
  check(
    "graded at the closing line, like a late human pick",
    filled.every((p) => p.spreadAtPick === (target.lockedSpread ?? target.spread)),
  );

  // Running again must not double up — the unique index plus the existence
  // check should make this a no-op.
  const again = await syncWeek(SEASON, WEEK);
  const twice = await db.select().from(picks).where(eq(picks.gameId, target.id));
  check(
    "a second sync adds nothing",
    twice.length === roster.length && again.autoPicked === 0,
    `${twice.length} rows, autoPicked=${again.autoPicked}`,
  );

  const reboard = await getBoard(SEASON, WEEK);
  const rg = reboard.find((x) => x.id === target.id)!;
  check("the board marks them auto", rg.picks.every((p) => p.auto));
  check("and they grade like any other pick", rg.picks.every((p) => p.result !== null));
}

await cleanup();
console.log(`\n${failures === 0 ? "SIMULATION PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
