import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALLOWED_DOMAIN, isAllowedEmail } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Magic-link landing route. Supabase redirects here with `?code=…`; we exchange
 * it for a session, enforce the domain restriction, provision/lookup the
 * profile (org + role), reject disabled accounts, then redirect into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const fail = (error: string) =>
    NextResponse.redirect(`${origin}/login?error=${error}`);

  if (!code) return fail("missing_code");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return fail("auth");

  const email = data.user.email.toLowerCase();
  if (!isAllowedEmail(email)) {
    await supabase.auth.signOut();
    return fail("forbidden_domain");
  }

  // Provision on first login (viewer), or look up the existing profile.
  let profile = await db.profiles.getByEmail(email);
  if (!profile) {
    const org = await db.orgs.getByDomain(ALLOWED_DOMAIN);
    if (!org) {
      await supabase.auth.signOut();
      return fail("no_org");
    }
    profile = await db.profiles.create({ orgId: org.id, email, role: "viewer" });
  }

  if (profile.disabled) {
    await supabase.auth.signOut();
    return fail("disabled");
  }

  await db.profiles.recordLogin(profile.organizationId, profile.id);
  return NextResponse.redirect(`${origin}/dashboard`);
}
