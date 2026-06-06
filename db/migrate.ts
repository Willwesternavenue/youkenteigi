import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { migrationDbUrl } from "./env";

/**
 * Applies pending SQL migrations to the Postgres database.
 * Run via `npm run db:migrate` (or `npm run setup`).
 *
 * Uses a single, non-pooled connection (`max: 1`) — point `DATABASE_URL` at the
 * Supabase *direct* connection (or session pooler) for migrations, not the
 * transaction pooler.
 */
async function main() {
  const url = migrationDbUrl();
  if (!url) {
    throw new Error(
      "No database URL found. Set DATABASE_URL (or the Vercel/Supabase POSTGRES_URL_NON_POOLING / POSTGRES_URL) before running migrations.",
    );
  }
  // prepare:false so this also works over the transaction pooler if that's the
  // only URL available; max:1 keeps migrations on a single connection.
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("✓ migrations applied");
  await client.end();
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
