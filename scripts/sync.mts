/**
 * Manual sync. Handy for seeding a fresh database or forcing a refresh.
 *   npx tsx scripts/sync.mts            # current week
 *   npx tsx scripts/sync.mts 2026 3     # a specific week
 */
import { syncWeek, getCurrentWeek } from "../lib/sync";
import { getBoard } from "../lib/queries";

const [seasonArg, weekArg] = process.argv.slice(2);

const cur = await getCurrentWeek();
const season = seasonArg ? Number(seasonArg) : cur.season;
const week = weekArg ? Number(weekArg) : cur.week;

console.log(`Syncing ${season} week ${week}...`);
const result = await syncWeek(season, week);
console.log(result);

const board = await getBoard(season, week);
console.log(`\nSlate (${board.length} games):`);
for (const g of board) {
  const sp = g.gradingSpread;
  const line =
    sp === null ? "no line" : sp === 0 ? "PK" : sp < 0 ? `${g.home.abbr} ${sp}` : `${g.away.abbr} -${sp}`;
  const score = g.home.score !== null ? ` ${g.away.score}-${g.home.score}` : "";
  console.log(
    `  ${g.away.abbr.padEnd(6)} @ ${g.home.abbr.padEnd(6)} ${line.padEnd(12)} ` +
      `${g.status.padEnd(4)} ${(g.statusDetail ?? "").padEnd(22)}${score}` +
      `  locked=${g.lockedSpread ?? "-"} picks=${g.picks.length}`,
  );
}
process.exit(0);
