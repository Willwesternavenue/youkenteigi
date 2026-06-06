import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { runtimeDbUrl } from "./env";

/**
 * The ONLY module allowed to import the database driver.
 *
 * Everything else in the app talks to the database through the repository
 * facade in lib/db.ts. The driver here is postgres-js pointed at Supabase
 * Postgres via `DATABASE_URL` (use the Supavisor / pgbouncer *transaction
 * pooler* connection string on Vercel serverless).
 *
 * `prepare: false` is required for the transaction pooler (pgbouncer does not
 * support prepared statements in transaction mode). The client connects lazily
 * on first query, so importing this module without a reachable database (e.g.
 * during `next build`) is safe.
 */

const client = postgres(runtimeDbUrl(), {
  // Required for the Supabase transaction pooler (pgbouncer, :6543) — the
  // runtime connection. Do NOT point runtime at the session pooler (:5432):
  // it holds a connection per client and exhausts under serverless concurrency
  // (pages fan out ~10 parallel queries). Migrations/seed use :5432 separately.
  prepare: false,
  // Release idle connections promptly so reused serverless instances don't
  // pin pooler connections.
  idle_timeout: 20,
});

export const database = drizzle(client, { schema });
export { schema };
