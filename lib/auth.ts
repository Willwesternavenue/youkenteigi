import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-cookie";
import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@/types/domain";

/**
 * Auth facade — the only entry point app code uses for identity.
 *
 * Local dev implementation: an encrypted iron-session cookie holds the signed-in
 * user. Login is email-only (no password) and restricted to the allowed domain.
 * Swapping to Supabase Auth / Google Identity Platform later means replacing the
 * cookie read/write below while keeping these exported signatures identical.
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

async function session() {
  const store = await cookies();
  return getIronSession<SessionData>(store, sessionOptions);
}

export async function getSession(): Promise<SessionUser | null> {
  const s = await session();
  if (!s.userId) return null;
  return {
    userId: s.userId,
    orgId: s.orgId,
    email: s.email,
    name: s.name,
    role: s.role,
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

export type SignInResult =
  | { ok: true }
  | { ok: false; error: "forbidden_domain" | "no_org" | "disabled" };

export async function signIn(emailRaw: string): Promise<SignInResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return { ok: false, error: "forbidden_domain" };
  }

  let profile = await db.profiles.getByEmail(email);
  if (!profile) {
    // First login: create a viewer profile under the org for this domain.
    const org = await db.orgs.getByDomain(ALLOWED_DOMAIN);
    if (!org) return { ok: false, error: "no_org" };
    profile = await db.profiles.create({
      orgId: org.id,
      email,
      role: "viewer",
    });
  }

  // Disabled accounts (deactivated by an admin) cannot sign in.
  if (profile.disabled) return { ok: false, error: "disabled" };

  await db.profiles.recordLogin(profile.id);

  const s = await session();
  s.userId = profile.id;
  s.orgId = profile.organizationId;
  s.email = profile.email;
  s.name = profile.name ?? email.split("@")[0];
  s.role = profile.role as Role;
  await s.save();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const s = await session();
  s.destroy();
}
