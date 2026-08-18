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

**You get the number you took.** Each pick is graded against the spread that was
on screen when it was made, not the closing line. Lines move, sometimes sharply
on late injury news, and settling everyone at the closing number would decide a
bet nobody agreed to. Two people can take the same team at different numbers and
get opposite results; when that happens the board prints each person's line next
to their avatar so the difference is never hidden.

**The closing line is still frozen at kickoff.** ESPN deletes the odds from a
game the moment it goes final, so without that snapshot the number would simply
vanish. It's the game's official result against the spread, and the fallback for
a pick made before the books had posted a line at all.

**Scoring.** A win is 1 point, a push is ½. The season table also tracks
outright weekly wins and current streak.

**Picks lock per game, not per week.** You can change any pick right up until
that specific game kicks off. Everyone can see everyone's picks at all times —
that's the point.

**Syncing.** Scores refresh whenever anyone loads the page, throttled to ~25
seconds while games are live and 10 minutes otherwise. The page auto-refreshes
itself while games are in progress. `/api/cron/sync` does the same on a schedule
so scores keep updating even with nobody watching.

---

## Running it locally

```bash
npm install
npm run dev
```

No configuration needed — it creates a SQLite file at `./data/pickem.db` and
seeds the four players on first run.

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

### Vercel + Turso (recommended, free)

1. **Database.** Create a free Turso database at
   [turso.tech](https://turso.tech) (or `turso db create pickem` with their
   CLI). Grab the database URL and an auth token.

2. **Push to GitHub**, then import the repo at
   [vercel.com/new](https://vercel.com/new).

3. **Environment variables** in Vercel:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | `libsql://your-db.turso.io` |
   | `DATABASE_AUTH_TOKEN` | the Turso token |
   | `CRON_SECRET` | any random string (optional) |

4. **Deploy.** The schema creates itself on first boot — there is no migration
   step to run or forget.

`vercel.json` registers an hourly cron against `/api/cron/sync`. Cron frequency
on Vercel's free tier is limited, and I haven't verified the current cap — if
hourly doesn't stick, point a free scheduler like
[cron-job.org](https://cron-job.org) at
`https://your-app.vercel.app/api/cron/sync?key=YOUR_CRON_SECRET` every 5 minutes
instead. Either way scores still update whenever someone has the page open,
which on a Saturday is most of the time.

### Anywhere else

Any Node host works. Set `DATABASE_URL` to a `file:` path on a persistent volume
(this is the Fly.io setup) or to a Turso URL, then `npm run build && npm start`.

---

## Not losing a season of picks

- Turso is a managed, replicated database — it's the durable copy.
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
