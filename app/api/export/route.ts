import { NextResponse } from "next/server";
import { db, ready, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Full database dump as JSON. Hit this any time you want an off-site copy of
 * every pick, score and line — the whole point being that a season's results
 * should never live in exactly one place.
 */
export async function GET() {
  await ready();

  const [players, games, picks, meta] = await Promise.all([
    db.select().from(schema.players),
    db.select().from(schema.games),
    db.select().from(schema.picks),
    db.select().from(schema.meta),
  ]);

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), players, games, picks, meta },
    null,
    2,
  );

  return new NextResponse(body, {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="pickem-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
