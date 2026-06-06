"use server";

import { redirect } from "next/navigation";
import { signIn, signOut, ALLOWED_DOMAIN } from "@/lib/auth";

export async function loginAction(email: string) {
  const result = await signIn(email);
  if (!result.ok) {
    if (result.error === "forbidden_domain") {
      return {
        ok: false as const,
        error: `@${ALLOWED_DOMAIN} のメールアドレスのみログインできます。`,
      };
    }
    return {
      ok: false as const,
      error: "組織が初期化されていません。`npm run db:seed` を実行してください。",
    };
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
