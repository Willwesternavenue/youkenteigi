import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@/types/domain";

/**
 * Auth facade — the only entry point app code uses for identity.
 *
 * Implementation: Supabase Auth (passwordless email magic-link, restricted to
 * the allowed domain). The Supabase session lives in cookies (managed by
 * @supabase/ssr); `profiles` remains the source of truth for org + role,
 * looked up by email. Login is initiated via the `requestMagicLink` server
 * action; the link lands on /auth/callback which establishes the session.
 *
 * These exported signatures are stable — swapping the auth provider again means
 * changing only this file + lib/supabase/* + the callback route.
 */

export interface SessionUser {
  userId: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
}

export const ALLOWED_DOMAIN =
  process.env.ALLOWED_EMAIL_DOMAIN ?? "aidealab.com";

// Individual external addresses allowed IN ADDITION to the org domain — e.g. a
// client/partner on Gmail. Comma-separated, set via the ALLOWED_EMAILS env var:
//   ALLOWED_EMAILS="alice@gmail.com,bob@example.jp"
// Each such user is still provisioned as a normal org member (default: viewer),
// so org-wide project visibility applies. Keep this list tight.
const ALLOWED_EMAILS = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e.endsWith(`@${ALLOWED_DOMAIN}`) || ALLOWED_EMAILS.has(e);
}

/**
 * Resolves the current user (Supabase auth → profile). Wrapped in React
 * `cache()` so the getUser() + profile lookup runs at most ONCE per request,
 * even though nested layouts + the page each call requireUser(). The proxy
 * (proxy.ts) performs the separate per-request token refresh.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.toLowerCase();
  // Defense in depth: only the allowed domain, only active profiles.
  if (!isAllowedEmail(email)) return null;

  const profile = await db.profiles.getByEmail(email);
  if (!profile || profile.disabled) return null;

  return {
    userId: profile.id,
    orgId: profile.organizationId,
    email: profile.email,
    name: profile.name ?? email.split("@")[0],
    role: profile.role as Role,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export function requireRole(user: SessionUser, permission: Permission): void {
  if (!can(user.role, permission)) {
    throw new Error(
      `権限がありません (${user.role} はこの操作を実行できません: ${permission})`,
    );
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
