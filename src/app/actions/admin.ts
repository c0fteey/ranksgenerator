"use server";

import { revalidatePath } from "next/cache";
import { isDiscordId, isPermission, type Permission } from "@/lib/access/permissions";
import { AccessError, forbiddenChanges, ownerIds, requirePermission } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { query } from "@/lib/server/db";
import { getGuildRoles } from "@/lib/server/discord";
import { createLicense, isLicenseKey, normalizeKey, revokeLicense } from "@/lib/server/licenses";
import type { ActionResult } from "./license";

async function guarded(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof AccessError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

// Inputs from the client are untrusted: keep only known permissions, deduplicated.
const cleanPermissions = (input: unknown): Permission[] => [...new Set(Array.isArray(input) ? input.filter(isPermission) : [])];

const done = (message: string): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: true, message };
};

export async function saveRolePermissions(roleId: unknown, permissions: unknown): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await requirePermission("access.manage");
    if (!isDiscordId(roleId)) return { ok: false, message: "Invalid role." };
    const roles = await getGuildRoles();
    const role = roles?.find((r) => r.id === roleId);
    if (!role) return { ok: false, message: "That role doesn't exist in the server (or the bot can't see it)." };

    const after = cleanPermissions(permissions);
    const [row] = await query<{ permissions: string[] }>(`SELECT permissions FROM role_permissions WHERE role_id = $1`, [roleId]);
    const before = cleanPermissions(row?.permissions);
    const denied = forbiddenChanges(actor, before, after);
    if (denied.length) return { ok: false, message: `You can't change permissions you don't have: ${denied.join(", ")}.` };

    if (after.length)
      await query(
        `INSERT INTO role_permissions (role_id, permissions, updated_by, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (role_id) DO UPDATE SET permissions = $2, updated_by = $3, updated_at = now()`,
        [roleId, after, actor.discordId],
      );
    else await query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
    await audit(actor.discordId, "role.permissions", roleId, { role: role.name, before, after });
    return done(`Saved permissions for @${role.name}.`);
  });
}

export async function saveAccountGrant(discordId: unknown, permissions: unknown, note: unknown): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await requirePermission("access.manage");
    if (!isDiscordId(discordId)) return { ok: false, message: "Enter a valid Discord user ID (17–20 digits)." };
    if (ownerIds().has(discordId)) return { ok: false, message: "Owners always have every permission." };
    if (discordId === actor.discordId) return { ok: false, message: "You can't change your own permissions." };

    const after = cleanPermissions(permissions);
    const [row] = await query<{ permissions: string[] }>(`SELECT permissions FROM account_grants WHERE discord_id = $1`, [discordId]);
    const before = cleanPermissions(row?.permissions);
    const denied = forbiddenChanges(actor, before, after);
    if (denied.length) return { ok: false, message: `You can't change permissions you don't have: ${denied.join(", ")}.` };

    const cleanNote = typeof note === "string" ? note.trim().slice(0, 100) || null : null;
    if (after.length)
      await query(
        `INSERT INTO account_grants (discord_id, permissions, note, updated_by, updated_at) VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (discord_id) DO UPDATE SET permissions = $2, note = $3, updated_by = $4, updated_at = now()`,
        [discordId, after, cleanNote, actor.discordId],
      );
    else await query(`DELETE FROM account_grants WHERE discord_id = $1`, [discordId]);
    await audit(actor.discordId, after.length ? "account.permissions" : "account.remove", discordId, { before, after, note: cleanNote });
    return done(after.length ? "Account access saved." : "Account access removed.");
  });
}

export async function createLicensesAction(input: unknown): Promise<ActionResult & { keys?: string[] }> {
  try {
    const actor = await requirePermission("licenses.manage");
    const { durationDays, count, note, assignTo } = (input ?? {}) as Record<string, unknown>;
    const days = durationDays === null ? null : Number(durationDays);
    if (days !== null && !(Number.isInteger(days) && days >= 1 && days <= 3650)) return { ok: false, message: "Duration must be 1–3650 days or lifetime." };
    const n = Number(count);
    if (!(Number.isInteger(n) && n >= 1 && n <= 25)) return { ok: false, message: "You can create 1–25 keys at a time." };
    const assign = assignTo === "" || assignTo == null ? null : assignTo;
    if (assign !== null && (!isDiscordId(assign) || n !== 1)) return { ok: false, message: "Assign to a valid Discord ID, one key at a time." };
    const cleanNote = typeof note === "string" ? note.trim().slice(0, 100) || null : null;

    const keys: string[] = [];
    for (let i = 0; i < n; i++) {
      const license = await createLicense({ durationDays: days, note: cleanNote, createdBy: actor.discordId, assignTo: assign });
      keys.push(license.key);
    }
    await audit(actor.discordId, "license.create", keys.length === 1 ? keys[0] : `${keys.length} keys`, { durationDays: days, note: cleanNote, assignTo: assign, keys });
    revalidatePath("/", "layout");
    return { ok: true, message: `Created ${keys.length} license key${keys.length > 1 ? "s" : ""}.`, keys };
  } catch (err) {
    if (err instanceof AccessError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: "Something went wrong. If you assigned the key, that account may already have an active license." };
  }
}

export async function revokeLicenseAction(key: unknown): Promise<ActionResult> {
  return guarded(async () => {
    const actor = await requirePermission("licenses.manage");
    if (typeof key !== "string" || !isLicenseKey(normalizeKey(key))) return { ok: false, message: "Invalid license key." };
    const license = await revokeLicense(key, actor.discordId);
    if (!license) return { ok: false, message: "License not found or already revoked." };
    await audit(actor.discordId, "license.revoke", license.key, { owner: license.owner_discord_id, developer: license.developer_discord_id });
    return done("License revoked.");
  });
}
