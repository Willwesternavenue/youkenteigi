import type { Config } from "drizzle-kit";

/**
 * Drizzle config for the local SQLite (libSQL) adapter.
 *
 * The DB file lives under ./data (gitignored). When this app later migrates to
 * Supabase / Cloud SQL, only `dialect` + `dbCredentials` change here and the
 * driver in db/client.ts swaps — the schema in db/schema.ts is reused as-is.
 */
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:./data/app.db",
  },
} satisfies Config;
