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

## Picking the games yourself

`/admin` lists the top 20 games for a week, ranked by the auto-picker, with the
ten it would choose already ticked. Untick one, tick another, hit **Save slate**.
**Auto** puts it back to the automatic ten.

Saving pins the week, so the automatic picker stops revising it. Two things can
never be removed: a game somebody has already picked, and a game that has
kicked off. Those rows show why they're locked and refuse to deselect — the
server enforces it too, not just the UI.

Set `ADMIN_KEY` in the environment to lock the page behind `?key=…`. Leave it
unset and the page is simply open, which is fine for four people.

## Insights

`/insights` is about the four of us rather than the sport:

- **Head to head** — only games where two of you took opposite sides.
- **Favourites vs underdogs** and **home vs road** splits, by the number each
  pick was actually taken at.
- **Going it alone** — your record when nobody joined you on that side.
- **Best and worst week**, and how unanimous picks have done.
- **Conference power rankings** and **conference head-to-head**, from
  non-conference games only — a conference's record against itself is .500 by
  construction and says nothing.
- **Teams against the spread**, minimum four games played.

The last three are league-wide: every FBS game gets stored each week, not just
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
   | `CRON_SECRET` | any random string (optional) |

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
