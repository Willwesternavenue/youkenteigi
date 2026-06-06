import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * The ONLY module allowed to import the database driver.
 *
 * Everything else in the app talks to the database through the repository
 * facade in lib/db.ts. To migrate to Supabase / Cloud SQL, replace the driver
 * here (drizzle-orm/postgres-js + a connection string) and keep db/schema.ts
 * and lib/db.ts untouched.
 */

const DB_URL = process.env.DATABASE_URL ?? "file:./data/app.db";

const client = createClient({ url: DB_URL });

export const database = drizzle(client, { schema });
export { schema };
