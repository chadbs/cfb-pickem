import { NextResponse } from "next/server";
import { CRON_SECRET } from "@/lib/config";
import { getCurrentWeek, syncWeek } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled refresh. Point Vercel Cron (or any free pinger like cron-job.org)
 * at /api/cron/sync so scores keep updating even when nobody has the app open.
 *
 * Also syncs next week, which is what gets the upcoming slate built early
 * enough for people to look ahead.
 */
export async function GET(request: Request) {
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    const key = new URL(request.url).searchParams.get("key");
    if (auth !== `Bearer ${CRON_SECRET}` && key !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const current = await getCurrentWeek();
    const results = [];

    results.push(await syncWeek(current.season, current.week));

    const next = current.week + 1;
    if (current.weeks.some((w) => w.week === next)) {
      try {
        results.push(await syncWeek(current.season, next));
      } catch {
        // Next week's schedule may not be posted yet — not an error.
      }
    }

    return NextResponse.json({ ok: true, at: new Date().toISOString(), results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
