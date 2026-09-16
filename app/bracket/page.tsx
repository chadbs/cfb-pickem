import Link from "next/link";
import { cookies } from "next/headers";
import { BracketBoard } from "@/components/BracketBoard";
import { SiteTabs } from "@/components/SiteNav";
import { LEAGUE_NAME } from "@/lib/config";
import { getPlayerBySlug } from "@/lib/queries";
import { getPlayoff } from "@/lib/playoff";
import { getCurrentWeek } from "@/lib/sync";

export const dynamic = "force-dynamic";

export default async function Bracket() {
  const current = await getCurrentWeek();
  const view = await getPlayoff(current.season);

  const slug = (await cookies()).get("pickem_player")?.value;
  const me = slug ? await getPlayerBySlug(slug) : null;

  return (
    <>
      <header className="glass sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-2 px-4 py-2.5 lg:px-6">
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
            <SiteTabs bracket={view.field.length > 0} />
          </span>
          <span className="nums ml-auto text-[12px] text-[var(--ink-faint)]">
            {view.locked ? "Locked" : "Playoff bracket"}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-4 lg:px-6 lg:pt-5">
        {view.field.length === 0 ? (
          <div className="card mx-auto flex max-w-md flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="text-2xl">🏆</span>
            <p className="text-[14px] font-semibold">The playoff field isn&apos;t set yet</p>
            <p className="max-w-[22rem] text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
              Once the twelve teams are announced in December, the bracket is seeded in the admin
              page and everyone fills one in. Straight winners, no spreads, and it locks at the
              first kickoff.
            </p>
            <Link
              href="/admin"
              className="mt-2 text-[12.5px] font-medium text-[var(--brand)] hover:underline"
            >
              Seed the field →
            </Link>
          </div>
        ) : (
          <BracketBoard view={view} meId={me?.id ?? null} />
        )}
      </main>
    </>
  );
}
