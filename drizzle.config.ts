import type { Config } from "drizzle-kit";
import { migrationDbUrl } from "./db/env";

/**
 * Drizzle config for Supabase Postgres.
 *
 * `db:generate` diffs db/schema.ts and writes SQL to ./db/migrations without a
 * live connection. `db:migrate` / `db:push` need a reachable `DATABASE_URL`
 * (use the Supabase direct connection or session pooler for migrations).
 */
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationDbUrl(),
  },
} satisfies Config;
