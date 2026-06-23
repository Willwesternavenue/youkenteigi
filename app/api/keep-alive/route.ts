import { db } from "@/lib/db";

export const runtime = "nodejs";
// Always execute fresh — never serve a cached response to the cron.
export const dynamic = "force-dynamic";

/**
 * Keep-alive endpoint hit by a Vercel Cron once a day (see vercel.json). It runs
 * a real DB query so Supabase counts the project as active and does NOT auto-
 * pause the free-tier project (which pauses after ~7 days of inactivity and then
 * needs a manual Restore). Unlike a GitHub Actions cron (auto-disabled when a
 * repo is inactive), Vercel Cron keeps running regardless of repo activity.
 *
 * If CRON_SECRET is set, we require Vercel's `Authorization: Bearer <secret>`
 * header so the endpoint can't be hammered by random callers. The query is a
 * harmless `select 1`, so leaving the secret unset is also safe.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    await db.ping();
    return Response.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
