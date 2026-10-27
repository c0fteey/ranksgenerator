// Creates/updates every table: Better Auth's (user, session, account, verification), then db/schema.sql.
// Run with DATABASE_URL set:  npm run db:migrate   (reads .env.local if present)
import { readFile } from "node:fs/promises";
import pg from "pg";
import { getMigrations } from "better-auth/db";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  // Same database settings as src/lib/server/auth.ts (core tables only; no plugins are used).
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations({ database: pool });
  if (toBeCreated.length || toBeAdded.length) {
    console.log("Better Auth:", [...toBeCreated, ...toBeAdded].map((t) => t.table).join(", "));
    await runMigrations();
  } else {
    console.log("Better Auth tables are up to date.");
  }
  await pool.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  console.log("App tables are up to date.");
} finally {
  await pool.end();
}
