import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { SiteTabs } from "@/components/SiteNav";
import { LEAGUE_NAME } from "@/lib/config";
import { recordLine } from "@/lib/format";
import { getInsights, MIN_TEAM_GAMES, pct, total, type Rec } from "@/lib/insights";
import { getCurrentWeek } from "@/lib/sync";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const current = await getCurrentWeek();
  const data = await getInsights(current.season);

  // Team and conference tables stand on their own now, so the page is worth
  // showing before anyone's picks have been graded.
  const hasPlayerData = data.splits.some((s) => total(s.overall) > 0);
  const anything = hasPlayerData || data.gradedGames > 0;

  return (
    <>
      <header className="glass sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-[940px] items-center gap-2 px-4 py-2.5 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] text-[12px]"
              style={{ background: "color-mix(in srgb, var(--brand) 22%, transparent)" }}
            >
              🏈
            </span>
            <h1 className="text-[14px] font-semibold tracking-[-0.011em]">{LEAGUE_NAME}</h1>
          </Link>
          <span className="ml-1">
            <SiteTabs />
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[940px] flex-1 px-4 pb-16 pt-4 lg:px-6 lg:pt-5">
        {!anything ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="text-2xl">📈</span>
            <p className="text-[14px] font-semibold">Nothing to analyse yet</p>
            <p className="max-w-[22rem] text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
              These fill in as games go final. Come back once a week or two has
              been played.
            </p>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {hasPlayerData && (
              <>
            <Section title="Head to head" hint="Only games where you disagreed">
              <ul>
                {data.h2h
                  .slice()
                  .sort((x, y) => y.games - x.games)
                  .map((h) => {
                    const lead = h.aWins === h.bWins ? null : h.aWins > h.bWins ? h.a : h.b;
                    return (
                      <li
                        key={`${h.a.id}-${h.b.id}`}
                        className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
                      >
                        <Avatar player={h.a} size={22} />
                        <span className="text-[12.5px] font-medium">{h.a.name}</span>
                        <span className="nums ml-auto text-[13px] font-semibold">
                          <span style={{ color: lead?.id === h.a.id ? h.a.accent : undefined }}>
                            {h.aWins}
                          </span>
                          <span className="mx-1 text-[var(--ink-faint)]">–</span>
                          <span style={{ color: lead?.id === h.b.id ? h.b.accent : undefined }}>
                            {h.bWins}
                          </span>
                        </span>
                        <span className="ml-auto text-[12.5px] font-medium">{h.b.name}</span>
                        <Avatar player={h.b} size={22} />
                      </li>
                    );
                  })}
              </ul>
            </Section>

            <Section title="Favourites vs underdogs" hint="By the number each pick was taken at">
              <ul>
                {data.splits.map((s) => (
                  <li
                    key={s.player.id}
                    className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
                  >
                    <Avatar player={s.player} size={22} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {s.player.name}
                    </span>
                    <Split label="fav" rec={s.favorites} />
                    <Split label="dog" rec={s.underdogs} />
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Home vs road" hint="Which side of the venue you back">
              <ul>
                {data.splits.map((s) => (
                  <li
                    key={s.player.id}
                    className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
                  >
                    <Avatar player={s.player} size={22} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {s.player.name}
                    </span>
                    <Split label="home" rec={s.home} />
                    <Split label="road" rec={s.away} />
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Going it alone" hint="Games where nobody joined you on that side">
              <ul>
                {data.splits.map((s) => (
                  <li
                    key={s.player.id}
                    className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
                  >
                    <Avatar player={s.player} size={22} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {s.player.name}
                    </span>
                    <span className="nums text-[12.5px] font-semibold">
                      {total(s.alone) ? recordLine(s.alone.wins, s.alone.losses, s.alone.pushes) : "—"}
                    </span>
                    <span className="nums w-[46px] text-right text-[11.5px] text-[var(--ink-faint)]">
                      {total(s.alone) ? `${Math.round(pct(s.alone) * 100)}%` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Best & worst week">
              <ul>
                {data.splits.map((s) => (
                  <li
                    key={s.player.id}
                    className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
                  >
                    <Avatar player={s.player} size={22} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {s.player.name}
                    </span>
                    {s.bestWeek && (
                      <span className="nums text-[11.5px]">
                        <span className="text-[var(--ink-faint)]">wk{s.bestWeek.week} </span>
                        <span className="font-semibold text-[var(--win)]">
                          {recordLine(s.bestWeek.rec.wins, s.bestWeek.rec.losses, s.bestWeek.rec.pushes)}
                        </span>
                      </span>
                    )}
                    {s.worstWeek && (
                      <span className="nums text-[11.5px]">
                        <span className="text-[var(--ink-faint)]">wk{s.worstWeek.week} </span>
                        <span className="font-semibold text-[var(--loss)]">
                          {recordLine(s.worstWeek.rec.wins, s.worstWeek.rec.losses, s.worstWeek.rec.pushes)}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>

              </>
            )}

            <Section
              title="Conference power rankings"
              hint="Straight-up record in non-conference games"
            >
              {data.conferences.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-[var(--ink-faint)]">
                  Nothing cross-conference has finished yet.
                </p>
              ) : (
                <ul>
                  {data.conferences.map((c) => {
                    const n = c.wins + c.losses;
                    return (
                      <li
                        key={c.id}
                        className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                          {c.name}
                        </span>
                        <span className="nums text-[12.5px] font-semibold">
                          {c.wins}-{c.losses}
                        </span>
                        <span className="nums w-[46px] text-right text-[11.5px] text-[var(--ink-faint)]">
                          {n ? `${Math.round((c.wins / n) * 100)}%` : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="Conference matchups" hint="Head to head, non-conference games">
              {data.conferenceMatchups.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-[var(--ink-faint)]">
                  Nothing to compare yet.
                </p>
              ) : (
                <ul>
                  {data.conferenceMatchups.map((m) => (
                    <li
                      key={`${m.a}-${m.b}`}
                      className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{m.a}</span>
                      <span className="nums shrink-0 text-[13px] font-semibold">
                        <span className={m.aWins > m.bWins ? "text-[var(--win)]" : undefined}>
                          {m.aWins}
                        </span>
                        <span className="mx-1 text-[var(--ink-faint)]">–</span>
                        <span className={m.bWins > m.aWins ? "text-[var(--win)]" : undefined}>
                          {m.bWins}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-right text-[12.5px] font-medium">
                        {m.b}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Teams against the spread"
              hint={`All ${data.gradedGames} completed FBS games, minimum ${MIN_TEAM_GAMES} played`}
            >
              {data.teams.length === 0 ? (
                <p className="px-3 py-3 text-[12px] leading-relaxed text-[var(--ink-faint)]">
                  No team has played {MIN_TEAM_GAMES} games with a line on record yet.
                </p>
              ) : (
                <ul>
                  {data.teams.map((t) => (
                    <li
                      key={t.teamId}
                      className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2 last:border-b-0"
                    >
                      {t.logo ? (
                        <Image
                          src={t.logo}
                          alt=""
                          width={20}
                          height={20}
                          className="h-5 w-5 shrink-0 object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full bg-white/5" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{t.abbr}</span>
                      <span className="nums text-[11px] text-[var(--ink-faint)]">
                        {total(t.rec)} gm
                      </span>
                      <span className="nums text-[12.5px] font-semibold">
                        {recordLine(t.rec.wins, t.rec.losses, t.rec.pushes)}
                      </span>
                      <span className="nums w-[46px] text-right text-[11.5px] text-[var(--ink-faint)]">
                        {Math.round(pct(t.rec) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {total(data.consensus) > 0 && (
              <Section title="When all four agreed" hint="The wisdom of this particular crowd">
                <p className="px-3 py-3 text-[13px]">
                  <span className="nums font-semibold">
                    {recordLine(data.consensus.wins, data.consensus.losses, data.consensus.pushes)}
                  </span>
                  <span className="text-[var(--ink-faint)]">
                    {" "}
                    on {total(data.consensus)} unanimous pick
                    {total(data.consensus) === 1 ? "" : "s"} ·{" "}
                    {Math.round(pct(data.consensus) * 100)}%
                  </span>
                </p>
              </Section>
            )}
          </div>
        )}

        <p className="mt-6 text-[11.5px] leading-relaxed text-[var(--ink-faint)]">
          Team and conference tables cover every FBS game, {data.gradedGames} of them
          played so far. Player stats cover the {data.gradedSlateGames} of those that
          were on our slate. Records against the spread skip any game where no line
          was ever posted.
        </p>
      </main>
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.055em] text-[var(--ink-faint)]">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Split({ label, rec }: { label: string; rec: Rec }) {
  const n = total(rec);
  return (
    <span className="w-[74px] shrink-0 text-right">
      <span className="mr-1 text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">{label}</span>
      <span className="nums text-[12.5px] font-semibold">
        {n ? recordLine(rec.wins, rec.losses, rec.pushes) : "—"}
      </span>
    </span>
  );
}
