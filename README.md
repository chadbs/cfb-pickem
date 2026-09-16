# The Pick'em

College football picks against the spread, for Darren, Chad, Jake and Eric.

Ten games a week — always every Colorado, Colorado State, Nebraska and Michigan
game, then the best of the rest. Live lines, live scores, no accounts, built for
a phone.

---

## How it works

**Games pick themselves.** Every FBS game in the week gets scored: a favorite
team is worth more than everything else combined, then ranked teams, tight
lines, national TV and primetime kickoffs. Top 10 make the slate.

The slate can still improve for a while after it's created — early in the week
the sportsbooks haven't posted lines yet, so the first cut is made half-blind.
It re-picks until either someone makes a pick or the first kickoff is inside 48
hours, whichever comes first. **A game that anyone has picked is never removed.**

**Lines and scores come from ESPN's public scoreboard feed.** No API key, no
account, no paid tier — it carries DraftKings lines right alongside the scores.

**Every FBS game is stored, not just our ten.** The slate is a flag on a row
rather than a separate table, which is what makes the league-wide team and
conference stats on `/insights` possible. It's roughly 100 games a week, written
in batches; nothing is ever deleted, so dropping a game from the slate can't
orphan a pick.

**One line settles everyone.** Every pick on a game is graded against that
game's closing line, frozen at kickoff — not the number each player happened to
see when they picked.

This was per-pick for a while, so that a late line move could not decide a bet
you never saw. The cost turned out to be worse than the cure: a quarter of the
picked games had people holding different numbers, and twice that straddled a
key number, where half a point is the difference between a push and a loss on
the same side of the same game. One number per game is easier to argue about and
impossible to feel cheated by.

Picks still record the number that was showing when they were made. Nothing
reads it now, but it costs nothing to keep and it is the only record of what
each person actually saw.

**The closing line is still frozen at kickoff.** ESPN deletes the odds from a
game the moment it goes final, so without that snapshot the number would simply
vanish. It's the game's official result against the spread, and the fallback for
a pick made before the books had posted a line at all.

**Nobody misses a week.** When a game kicks off, anyone who still hasn't picked
it gets one filled in automatically, flagged as auto and graded at the same
closing line a late human pick would have had. Auto-picks are drawn with a
dashed ring on the board and counted in a note at the top of the page, so they
are never mistaken for something you chose.

The rule claims no edge — a spread exists to split the action, so anything lands
near 50%. It is deterministic instead, so everyone who misses the same game gets
the same side and an auto-pick can never quietly advantage one player: take the
underdog off a number of 14 or more, otherwise take the home side. The threshold
is `AUTO_PICK_BIG_FAVORITE` in [`lib/config.ts`](lib/config.ts) and the rule
itself is [`lib/autopick.ts`](lib/autopick.ts).

**Scoring.** A win is 1 point, a push is ½. The season table also tracks
outright weekly wins and current streak.

**Lock of the week.** One pick a week can be locked, and it counts double: a hit
pays 2 and a miss costs 1, so calling your lock wrong is worse than being wrong
anywhere else. A push is left alone — there's nothing to double.

Locking is deliberate and a bit unforgiving on purpose. You can only lock a game
you've already picked, you can move the lock until that game kicks off, and once
it has kicked off the lock is committed — the whole point is that it was called
in advance. Miss the week entirely and nothing happens; an auto-picked game is
never auto-locked. The bonus is `LOCK_BONUS` in [`lib/config.ts`](lib/config.ts).

Points can therefore run ahead of or behind the record, and a bad enough week
can go negative. Win% is deliberately left as the record alone, so the two
numbers say different things: how often you were right, and what it was worth.

**Picks lock per game, not per week.** You can change any pick right up until
that specific game kicks off. Everyone can see everyone's picks at all times —
that's the point.

**Bowls are a week.** ESPN serves the whole postseason as one lump — every bowl
and every playoff game together, 46 of them in 2025 — so the app files it as
week 16, labelled **Bowls**. Ten of them get picked against the spread and
scored exactly like a Saturday in October, locks included. The tab appears once
ESPN switches to the postseason, which is a few days after championship
weekend. Cards show the bowl name, because "Ole Miss @ Miami" tells you nothing
in December.

**The playoff is a bracket instead.** Twelve teams, filled out in advance like
March Madness, straight winners, no spreads — a separate contest from the
weekly pool with its own table at `/bracket`.

Seed the field in `/admin` during bowls week: **Detect** reads all twelve off
ESPN's playoff games, which carry each team's bracket seed as its rank, and the
dropdowns are there for the year that goes wrong. The bracket itself follows
from the seeding — 5 v 12, 6 v 11, 7 v 10, 8 v 9, the top seed against whoever
survives 8/9, and the 1/4 half kept away from the 2/3 half until the final.

Rounds double: 1 point, 2, 4, then 8 for the title game, so 28 are on the table.
A correct pick also pays the seed difference whenever the lower seed wins — 12
over 5 is worth 7 more — which is what lets someone win the bracket from behind
by calling the chaos. Backing an underdog that loses pays nothing. Run against
the actual 2025 playoff, chalk scores 16 and a perfect bracket 48.

Picks cascade the way a paper bracket does: advance a team and the next round
opens up; change your mind and the picks that contradicted it disappear.
Everything freezes at the first playoff kickoff, and an unfinished bracket is
completed with chalk then, flagged auto — the same bargain the weekly slate
makes. **Fill with chalk** does it early for anyone who only has opinions about
three games.

**Syncing.** Scores refresh whenever anyone loads the page, throttled to ~25
seconds while games are live and 10 minutes otherwise. The page auto-refreshes
itself while games are in progress. `/api/cron/sync` does the same on a schedule
so scores keep updating even with nobody watching.

---

## Picking the games yourself

`/admin` lists every game in the week from the Big Ten, SEC, Big 12, Pac-12,
ACC, Mountain West and the independents, ranked by the auto-picker, with the ten
it would choose already ticked. **All FBS** widens it to the MAC, Sun Belt, CUSA
and the American; the filter box searches team and conference. Untick one, tick
another, hit **Save slate**. **Auto** puts it back to the automatic ten.

Saving pins the week, so the automatic picker stops revising it. Only a game
that has already kicked off can't be changed — the server enforces that, not
just the UI. Swapping out a game that has picks on it keeps them: they stop
counting, and count again if you put the game back, and anyone affected is told
on the picks page.

**Lines** sits above the list. ESPN never posts a number for some games —
FCS opponents mostly — and a slate game with no line would freeze as a pick'em
at kickoff, so those are flagged. Hit **Set**, choose the favorite and the
points, save. A line you set beats ESPN's until you switch back ("Use ESPN's"),
and it freezes at kickoff like any other. Changing a line after kickoff rewrites
the closing line and regrades the game — that's the fix for one that kicked off
with nothing posted.

Set `ADMIN_KEY` in the environment to lock the page behind `?key=…`. Leave it
unset and the page is simply open, which is fine for four people.

## Insights

`/insights` is about the four of us rather than the sport:

- **Head to head** — only games where two of you took opposite sides.
- **Favourites vs underdogs** and **home vs road** splits, by the game's line.
- **Going it alone** — your record when nobody joined you on that side.
- **Best and worst week**, and how unanimous picks have done.
- **Conference vs conference** — pick a conference (Big 12, Pac-12, SEC, Big
  Ten and ACC lead the tabs) and see its record straight up and against the
  spread against every other FBS conference, plus one row for all FCS
  opponents. Pairings that haven't happened yet are still listed, greyed out,
  so a missing row never looks like missing data.
- **Conference power rankings** — each conference's record against the rest of
  FBS. Both of these use non-conference games only: a conference's record
  against itself is .500 by construction and says nothing. FCS wins are shown
  but kept out of the rankings, since beating an FCS team says little.
- **Teams against the spread**, minimum four games played.

The conference and team tables are league-wide: every FBS game gets stored each week, not just
our ten, so these are full-season samples. Games that never had a line posted
are left out of anything against the spread rather than counted as pick'ems.

## Running it locally

```bash
npm install
npm run dev
```

You need the database connection string first:

```bash
vercel link          # once, to attach this folder to the Vercel project
vercel env pull .env.local
```

That writes `DATABASE_URL` into `.env.local` (gitignored). The schema creates
itself and the four players are seeded on first run.

Local development shares the production database. For a four-person pool that's
usually what you want — you can see real picks while working — but it does mean
a stray `npm run sync` writes to the live data. Use a
[Neon branch](https://neon.tech/docs/introduction/branching) if you'd rather it
didn't.

Useful commands:

```bash
npm run verify
```

Checks spread parsing, ATS grading and leaderboard maths, then pulls the real
current week from ESPN and prints the slate it would pick.

```bash
npm run simulate
```

The important one. Loads real completed games, stores them with a known line,
lets the sync run as if they'd just finished, and asserts every result grades
exactly as predicted — including the case where ESPN has already dropped the
odds. Cleans up after itself.

```bash
npm run sync           # sync the current week
npm run sync 2026 3    # or a specific one
```

---

## Deploying

### Vercel + Neon (free)

1. **Push to GitHub**, then import the repo at
   [vercel.com/new](https://vercel.com/new).

2. **Database.** In the project, go to **Storage → Create Database → Neon**,
   pick the Free plan and a region matching your functions (`iad1` here). When
   it asks to connect the project, set the **custom prefix to `DATABASE`** so
   the injected variable is `DATABASE_URL` — the default `STORAGE` prefix
   produces `STORAGE_URL`, which the app doesn't read. Tick **Development** too
   if you want `vercel env pull` to work locally.

   Vercel writes the connection string itself; there's no token to copy.

3. **Environment variables** — only one is required, and Neon sets it:

   | Name | Set by |
   | --- | --- |
   | `DATABASE_URL` | the Neon integration |
   | `CRON_SECRET` | you, optionally |

4. **Deploy.** The schema creates itself on first boot — there is no migration
   step to run or forget.

`vercel.json` registers a **daily** cron against `/api/cron/sync`. Daily is not a
preference — Vercel's Hobby plan rejects anything more frequent, and a build
with an hourly schedule fails outright.

Daily is only a backstop. Scores refresh whenever anyone loads the page
(throttled to ~25s while games are live), which on a Saturday covers it. If you
want them moving with nobody watching, point a free scheduler like
[cron-job.org](https://cron-job.org) at
`https://your-app.vercel.app/api/cron/sync?key=YOUR_CRON_SECRET` every 5
minutes.

### Reusing an existing Vercel project

If you point an old project at this repo rather than creating a new one, check
three settings — each of these failed the build outright when this app replaced
a Vite SPA in the same project:

| Setting | Must be |
| --- | --- |
| Root Directory | empty (the app is at the repo root, not in `client/`) |
| Framework Preset | Next.js |
| Cron schedule | daily — Hobby rejects anything more frequent |

### Anywhere else

Any Node host and any Postgres works. Point `DATABASE_URL` at it and run
`npm run build && npm start`. Nothing is Neon-specific — `prepare: false` in the
client is there for Neon's transaction-mode pooler and is harmless elsewhere.

---

## Not losing a season of picks

- Neon is a managed Postgres with its own backups — it's the durable copy.
- `GET /api/export` returns every player, game, pick and line as a JSON file.
  Download it whenever you want an off-site backup.
- Picks are never deleted by any automatic process. The slate re-picker
  explicitly refuses to drop a game that has a pick on it.

---

## Changing things

Nearly everything tunable lives in [`lib/config.ts`](lib/config.ts): the player
roster, the four favorite teams (by ESPN team id), how many games per week, and
the sync intervals.

To pin a specific game into a week by hand, set `manual_pin = 1` on its row —
the auto-picker will then build the rest of the slate around it.

Scoring weights live in [`lib/selection.ts`](lib/selection.ts) if you want
different games showing up.
