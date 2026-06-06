"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALLOWED_DOMAIN, isAllowedEmail, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

export type MagicLinkResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Send a passwordless magic-link to an @aidealab.com address. Domain is
 * enforced here (and again in the callback). Disabled accounts are refused.
 */
export async function requestMagicLink(emailRaw: string): Promise<MagicLinkResult> {
  const email = emailRaw.trim().toLowerCase();

  if (!isAllowedEmail(email)) {
    return {
      ok: false,
      error: `@${ALLOWED_DOMAIN} のメールアドレスのみログインできます。`,
    };
  }

  // Refuse disabled accounts up front (don't even send a link).
  const profile = await db.profiles.getByEmail(email);
  if (profile?.disabled) {
    return {
      ok: false,
      error: "このアカウントは無効化されています。管理者にお問い合わせください。",
    };
  }

  // Build the callback URL from the incoming request origin (works on
  // localhost and on the deployed domain).
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = `${proto}://${host}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return {
      ok: false,
      error: "ログインリンクを送信できませんでした。時間をおいて再度お試しください。",
    };
  }

  return { ok: true };
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
