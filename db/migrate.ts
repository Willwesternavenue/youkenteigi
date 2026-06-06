import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

/**
 * Applies pending SQL migrations to the local SQLite database.
 * Run via `npm run db:migrate` (or `npm run setup`).
 */
async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const client = createClient({ url });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("✓ migrations applied");
  client.close();
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
