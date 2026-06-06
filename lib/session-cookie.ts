import type { SessionOptions } from "iron-session";
import type { Role } from "@/types/domain";

/**
 * iron-session configuration for the local dev cookie auth adapter.
 * Used ONLY by lib/auth.ts. When Supabase Auth / Google Identity Platform is
 * wired later, this file and the cookie-reading code in lib/auth.ts are the
 * only things that change.
 */

export interface SessionData {
  userId: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
}

const PASSWORD =
  process.env.SESSION_PASSWORD ??
  "dev-only-insecure-password-change-me-32+chars-long";

export const sessionOptions: SessionOptions = {
  password: PASSWORD,
  cookieName: "ykk_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};
