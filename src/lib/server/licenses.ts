import "server-only";
import { randomBytes } from "node:crypto";
import { pool, query } from "./db";

export type LicenseStatus = "unused" | "active" | "expired" | "revoked";

export interface License {
  id: string;
  key: string;
  status: LicenseStatus;
  duration_days: number | null;
  owner_discord_id: string | null;
  developer_discord_id: string | null;
  note: string | null;
  created_by: string;
  created_at: Date;
  activated_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
}

const COLUMNS = `id, key, status, duration_days, owner_discord_id, developer_discord_id, note, created_by, created_at, activated_at, expires_at, revoked_at`;

// XXXX-XXXX-XXXX-XXXX-XXXX-XXXX: 96 random bits, uppercase hex.
const KEY_PATTERN = /^[0-9A-F]{4}(-[0-9A-F]{4}){5}$/;

export const normalizeKey = (input: string) => input.trim().toUpperCase();
export const isLicenseKey = (key: string) => KEY_PATTERN.test(key);

function newKey() {
  return (randomBytes(12).toString("hex").toUpperCase().match(/.{4}/g) as string[]).join("-");
}

/** Status as the user sees it: an active license past its expiry reads as expired. */
export function effectiveStatus(l: Pick<License, "status" | "expires_at">): LicenseStatus {
  return l.status === "active" && l.expires_at && l.expires_at.getTime() <= Date.now() ? "expired" : l.status;
}

/** New key, unused; or, with `assignTo`, already active for that account (e.g. issued by the bot). */
export async function createLicense(opts: { durationDays: number | null; note: string | null; createdBy: string; assignTo?: string | null }): Promise<License> {
  const assign = opts.assignTo ?? null;
  if (assign) {
    // Retire a lapsed license so the one-live-license-per-owner index allows the new one.
    await query(`UPDATE licenses SET status = 'expired' WHERE owner_discord_id = $1 AND status = 'active' AND expires_at <= now()`, [assign]);
  }
  const rows = await query<License>(
    `INSERT INTO licenses (key, duration_days, note, created_by, status, owner_discord_id, activated_at, expires_at)
     VALUES ($1, $2::int, $3, $4,
       CASE WHEN $5::text IS NULL THEN 'unused' ELSE 'active' END,
       $5::text,
       CASE WHEN $5::text IS NULL THEN NULL ELSE now() END,
       CASE WHEN $5::text IS NULL OR $2::int IS NULL THEN NULL ELSE now() + make_interval(days => $2::int) END)
     RETURNING ${COLUMNS}`,
    [newKey(), opts.durationDays, opts.note, opts.createdBy, assign],
  );
  return rows[0];
}

export type ActivateResult = { ok: true; license: License } | { ok: false; error: string };

const ATTEMPT_WINDOW_MIN = 15;
const MAX_FAILED_ATTEMPTS = 8;

/**
 * Bind an unused key to `discordId`. Runs in one transaction with the key row locked, so a key
 * can't be claimed twice. Failed attempts are rate limited per account.
 */
export async function activateLicense(discordId: string, rawKey: string): Promise<ActivateResult> {
  const key = normalizeKey(rawKey);
  const client = await pool().connect();
  try {
    const recent = await client.query<{ count: string }>(
      `SELECT count(*) FROM license_attempts WHERE discord_id = $1 AND NOT success AND created_at > now() - make_interval(mins => $2)`,
      [discordId, ATTEMPT_WINDOW_MIN],
    );
    if (Number(recent.rows[0].count) >= MAX_FAILED_ATTEMPTS) return { ok: false, error: `Too many attempts. Try again in ${ATTEMPT_WINDOW_MIN} minutes.` };

    const fail = async (error: string): Promise<ActivateResult> => {
      await client.query("ROLLBACK");
      await client.query(`INSERT INTO license_attempts (discord_id, success) VALUES ($1, false)`, [discordId]);
      return { ok: false, error };
    };

    await client.query("BEGIN");
    if (!isLicenseKey(key)) return fail("That doesn't look like a license key.");

    await client.query(`UPDATE licenses SET status = 'expired' WHERE owner_discord_id = $1 AND status = 'active' AND expires_at <= now()`, [discordId]);
    const current = await client.query(`SELECT 1 FROM licenses WHERE owner_discord_id = $1 AND status = 'active'`, [discordId]);
    if (current.rows.length) return fail("Your account already has an active license.");

    const found = await client.query<License>(`SELECT ${COLUMNS} FROM licenses WHERE key = $1 FOR UPDATE`, [key]);
    const license = found.rows[0];
    if (!license || license.status !== "unused") return fail("This license key is invalid or already used.");

    const updated = await client.query<License>(
      `UPDATE licenses SET status = 'active', owner_discord_id = $2, activated_at = now(),
         expires_at = CASE WHEN duration_days IS NULL THEN NULL ELSE now() + make_interval(days => duration_days) END
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [license.id, discordId],
    );
    await client.query(`INSERT INTO license_attempts (discord_id, success) VALUES ($1, true)`, [discordId]);
    await client.query("COMMIT");
    return { ok: true, license: updated.rows[0] };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** The license an account owns (latest non-revoked one), if any. */
export async function licenseOwnedBy(discordId: string): Promise<License | null> {
  const rows = await query<License>(
    `SELECT ${COLUMNS} FROM licenses WHERE owner_discord_id = $1 AND status IN ('active', 'expired') ORDER BY activated_at DESC LIMIT 1`,
    [discordId],
  );
  return rows[0] ?? null;
}

export async function setDeveloper(licenseId: string, developerId: string | null) {
  await query(`UPDATE licenses SET developer_discord_id = $2 WHERE id = $1`, [licenseId, developerId]);
}

export async function revokeLicense(key: string, by: string): Promise<License | null> {
  const rows = await query<License>(
    `UPDATE licenses SET status = 'revoked', revoked_at = now(), revoked_by = $2 WHERE key = $1 AND status <> 'revoked' RETURNING ${COLUMNS}`,
    [normalizeKey(key), by],
  );
  return rows[0] ?? null;
}

export async function findLicenses(by: { key?: string; discordId?: string }): Promise<License[]> {
  if (by.key) return query<License>(`SELECT ${COLUMNS} FROM licenses WHERE key = $1`, [normalizeKey(by.key)]);
  if (by.discordId)
    return query<License>(`SELECT ${COLUMNS} FROM licenses WHERE owner_discord_id = $1 OR developer_discord_id = $1 ORDER BY created_at DESC`, [by.discordId]);
  return [];
}

export const recentLicenses = (limit = 200) => query<License>(`SELECT ${COLUMNS} FROM licenses ORDER BY created_at DESC LIMIT $1`, [limit]);

/** Display names of accounts that have signed in, keyed by Discord ID. */
export async function namesFor(discordIds: (string | null)[]): Promise<Record<string, { name: string; image: string | null }>> {
  const ids = [...new Set(discordIds.filter((id): id is string => !!id))];
  if (!ids.length) return {};
  const rows = await query<{ accountId: string; name: string; image: string | null }>(
    `SELECT a."accountId", u.name, u.image FROM account a JOIN "user" u ON u.id = a."userId"
     WHERE a."providerId" = 'discord' AND a."accountId" = ANY($1::text[])`,
    [ids],
  );
  return Object.fromEntries(rows.map((r) => [r.accountId, { name: r.name, image: r.image }]));
}
