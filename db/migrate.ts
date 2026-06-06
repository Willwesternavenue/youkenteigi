import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies pending SQL migrations to the Postgres database.
 * Run via `npm run db:migrate` (or `npm run setup`).
 *
 * Uses a single, non-pooled connection (`max: 1`) — point `DATABASE_URL` at the
 * Supabase *direct* connection (or session pooler) for migrations, not the
 * transaction pooler.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required to run migrations (Supabase Postgres connection string).",
    );
  }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("✓ migrations applied");
  await client.end();
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
