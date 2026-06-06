import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase server client (auth facade internal — only lib/auth.ts, the auth
 * callback route, and the auth server actions use this).
 *
 * Reads/writes the session via Next's cookie store. Setting cookies is a no-op
 * when called from a React Server Component render (not allowed there); the
 * proxy (proxy.ts) refreshes the session cookie on each request instead.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from an RSC render — cookies are read-only there. The proxy
            // handles token refresh, so this is safe to ignore.
          }
        },
      },
    },
  );
}
