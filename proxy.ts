import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next 16 "proxy" (formerly middleware). Refreshes the Supabase auth session on
 * each request and writes the rotated cookies onto the response, so Server
 * Components (which can't write cookies) always see a valid session.
 *
 * Auth/authorization itself is enforced in requireUser()/requireRole() per
 * route — this only keeps the token fresh.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the session so an expired access token gets refreshed (and the new
  // cookie written above). Do not gate routes here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and Next internals. Keeping it broad
     * (incl. pages + the auth callback) ensures the session cookie stays fresh.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff2?)$).*)",
  ],
};
