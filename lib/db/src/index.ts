import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

try {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("unsupported protocol");
  }
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
}

const poolMax = Number(process.env.DATABASE_POOL_MAX ?? "10");
if (!Number.isInteger(poolMax) || poolMax < 1) {
  throw new Error("DATABASE_POOL_MAX must be a positive integer.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export * from "./schema";
