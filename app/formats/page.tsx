import Link from "next/link";
import { PlayoffFormats } from "@/components/PlayoffFormats";
import { SiteTabs } from "@/components/SiteNav";
import { LEAGUE_NAME } from "@/lib/config";
import { hasBracket } from "@/lib/playoff";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Playoff formats · ${LEAGUE_NAME}`,
  description: "What a 16- or 24-team playoff with conference champion byes would look like.",
};

export default async function Formats() {
  const bracket = await hasBracket().catch(() => false);

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
            <SiteTabs bracket={bracket} />
          </span>
          <span className="nums ml-auto text-[12px] text-[var(--ink-faint)]">Playoff formats</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-4 lg:px-6 lg:pt-5">
        <PlayoffFormats />
      </main>
    </>
  );
}
