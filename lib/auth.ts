import "server-only";
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

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export async function getSession(): Promise<SessionUser | null> {
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
}

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
