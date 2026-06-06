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

const client = postgres(runtimeDbUrl(), { prepare: false });

export const database = drizzle(client, { schema });
export { schema };
