import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to apply Hael Studio migrations.");
  process.exit(1);
}

try {
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("unsupported protocol");
  }
} catch {
  console.error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  process.exit(1);
}

const migrationsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const migrationNames = (await readdir(migrationsPath))
  .filter((name) => /^\d{4,}_[a-z0-9_]+\.sql$/.test(name))
  .sort();
const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
} catch (error) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? ` (Postgres code ${error.code})`
    : "";
  console.error(`Could not connect to PostgreSQL${code}. Check DATABASE_URL, connectivity, and TLS settings.`);
  await pool.end();
  process.exit(1);
}

try {
  await client.query("SELECT pg_advisory_lock(hashtext('hael_studio_migrations'))");
  await client.query(`
    CREATE TABLE IF NOT EXISTS hael_schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query("SELECT id FROM hael_schema_migrations");
  const applied = new Set(rows.map(({ id }) => id));

  for (const name of migrationNames) {
    if (applied.has(name)) continue;
    const sql = await readFile(path.join(migrationsPath, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO hael_schema_migrations (id) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.info(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  if (migrationNames.length === 0) console.info("No Hael Studio migrations found.");
} catch (error) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? ` (Postgres code ${error.code})`
    : "";
  console.error(`Hael Studio migrations failed${code}. Check DATABASE_URL, connectivity, and database permissions.`);
  process.exitCode = 1;
} finally {
  try {
    await client.query("SELECT pg_advisory_unlock(hashtext('hael_studio_migrations'))");
  } catch {}
  client.release();
  await pool.end();
}
