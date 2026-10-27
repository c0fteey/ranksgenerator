import "server-only";
import { Pool, type QueryResultRow } from "pg";
import { env } from "./env";

// One pool per server instance; survives dev hot reloads. Use Neon's pooled connection string on Vercel.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export function pool(): Pool {
  globalForDb.pgPool ??= new Pool({ connectionString: env("DATABASE_URL"), max: 5 });
  return globalForDb.pgPool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool().query<T>(text, params);
  return result.rows;
}
