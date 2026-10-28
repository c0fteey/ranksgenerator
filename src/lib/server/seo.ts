import "server-only";
import { cacheTag } from "next/cache";
import { DEFAULT_SEO, normalizeSeo, type SeoSettings } from "../seo";
import { query } from "./db";

export const SEO_TAG = "seo";

// The tables are also in db/schema.sql; creating them here too means the SEO tab works on a
// database that was migrated before it existed.
async function ensureTables() {
  await query(`CREATE TABLE IF NOT EXISTS site_settings (
    key text PRIMARY KEY, value jsonb NOT NULL, updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await query(`CREATE TABLE IF NOT EXISTS site_assets (
    name text PRIMARY KEY, content_type text NOT NULL, data bytea NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
}

const missingTable = (err: unknown) => (err as { code?: string })?.code === "42P01";

/** Current settings, cached until the admin saves. Falls back to defaults so metadata never breaks a page. */
export async function getSeo(): Promise<SeoSettings> {
  "use cache";
  cacheTag(SEO_TAG);
  return readSeo();
}

/** Uncached read, for the admin form. */
export async function readSeo(): Promise<SeoSettings> {
  try {
    const [row] = await query<{ value: unknown }>(`SELECT value FROM site_settings WHERE key = 'seo'`);
    return row ? normalizeSeo(row.value) : DEFAULT_SEO;
  } catch (err) {
    if (!missingTable(err)) console.error("seo settings read failed", err);
    return DEFAULT_SEO;
  }
}

export async function writeSeo(settings: SeoSettings, actor: string) {
  await ensureTables();
  await query(
    `INSERT INTO site_settings (key, value, updated_by, updated_at) VALUES ('seo', $1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = now()`,
    [JSON.stringify(settings), actor],
  );
}

export async function writeSeoImage(contentType: string, data: Buffer) {
  await ensureTables();
  await query(
    `INSERT INTO site_assets (name, content_type, data, updated_at) VALUES ('seo-image', $1, $2, now())
     ON CONFLICT (name) DO UPDATE SET content_type = $1, data = $2, updated_at = now()`,
    [contentType, data],
  );
}

export async function readSeoImage(): Promise<{ contentType: string; data: Buffer } | null> {
  try {
    const [row] = await query<{ content_type: string; data: Buffer }>(`SELECT content_type, data FROM site_assets WHERE name = 'seo-image'`);
    return row ? { contentType: row.content_type, data: row.data } : null;
  } catch (err) {
    if (!missingTable(err)) console.error("seo image read failed", err);
    return null;
  }
}
