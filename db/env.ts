/**
 * Resolves the Postgres connection string from the environment.
 *
 * Priority: an explicit `DATABASE_URL` always wins (local .env.local / manual
 * override). Otherwise we fall back to the variables injected automatically by
 * the Vercel ↔ Supabase Marketplace integration:
 *   - POSTGRES_URL              → pooled (transaction pooler, :6543) — runtime
 *   - POSTGRES_URL_NON_POOLING  → direct (:5432) — migrations / seed
 *
 * No driver import here, so this is safe to import from db/client.ts,
 * db/migrate.ts, db/seed.ts and drizzle.config.ts alike (facade rule intact).
 */

/** Connection string for the running app (prefers the pooled connection). */
export function runtimeDbUrl(): string {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

/** Connection string for migrations / seed (prefers the direct connection). */
export function migrationDbUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    ""
  );
}
