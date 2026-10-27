import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { OWNER_IDS, STATIC_ACCOUNT_GRANTS } from "../access/config";
import { ALL_PERMISSIONS, LICENSE_PERMISSIONS, isPermission, type Permission } from "../access/permissions";
import { auth } from "./auth";
import { query } from "./db";
import { getMemberRoles } from "./discord";

// Data Access Layer for authorization. Rules:
// - Permissions are computed on the server for every request from the session row, the database
//   and Discord. Nothing the browser sends (cookie contents, form fields) is trusted for access.
// - Every source fails closed: an error or missing config removes access, never adds it.
// - Server actions and route handlers call requirePermission() themselves; hiding UI is not a check.

export type AccessSource = "owner" | "code" | "account" | "role" | "license" | "developer";

export interface Viewer {
  userId: string;
  discordId: string;
  name: string;
  email: string;
  image: string | null;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
  /** Why each permission was granted, for the admin panel and debugging. */
  sources: Readonly<Partial<Record<Permission, AccessSource[]>>>;
  /** True when the viewer owns a license that is not revoked (active or expired). */
  hasLicense: boolean;
}

export function ownerIds(): Set<string> {
  const extra = (process.env.OWNER_DISCORD_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return new Set([...OWNER_IDS, ...extra]);
}

const keepPermissions = (values: unknown): Permission[] => (Array.isArray(values) ? values.filter(isPermission) : []);

async function discordIdFor(userId: string): Promise<string | null> {
  const rows = await query<{ accountId: string }>(`SELECT "accountId" FROM account WHERE "userId" = $1 AND "providerId" = 'discord' LIMIT 1`, [userId]);
  return rows[0]?.accountId ?? null;
}

/** Permissions for a Discord account, with the source of each one. */
export async function resolvePermissions(discordId: string) {
  const sources: Partial<Record<Permission, AccessSource[]>> = {};
  const grant = (perms: readonly Permission[], source: AccessSource) => {
    for (const p of perms) {
      const list = (sources[p] ??= []);
      if (!list.includes(source)) list.push(source);
    }
  };

  const isOwner = ownerIds().has(discordId);
  if (isOwner) grant(ALL_PERMISSIONS, "owner");
  grant(keepPermissions(STATIC_ACCOUNT_GRANTS[discordId]), "code");

  const [accountRows, roleIds, licenseRows] = await Promise.all([
    query<{ permissions: string[] }>(`SELECT permissions FROM account_grants WHERE discord_id = $1`, [discordId]),
    getMemberRoles(discordId),
    // Live licenses this account owns or holds a developer seat on.
    query<{ owner_discord_id: string | null; developer_discord_id: string | null; status: string; expires_at: Date | null }>(
      `SELECT owner_discord_id, developer_discord_id, status, expires_at FROM licenses
       WHERE (owner_discord_id = $1 OR developer_discord_id = $1) AND status IN ('active', 'expired')`,
      [discordId],
    ),
  ]);

  grant(keepPermissions(accountRows[0]?.permissions), "account");

  if (roleIds.length) {
    const roleRows = await query<{ permissions: string[] }>(`SELECT permissions FROM role_permissions WHERE role_id = ANY($1::text[])`, [roleIds]);
    for (const row of roleRows) grant(keepPermissions(row.permissions), "role");
  }

  const now = Date.now();
  const live = (l: (typeof licenseRows)[number]) => l.status === "active" && (!l.expires_at || l.expires_at.getTime() > now);
  if (licenseRows.some((l) => l.owner_discord_id === discordId && live(l))) grant(LICENSE_PERMISSIONS, "license");
  if (licenseRows.some((l) => l.developer_discord_id === discordId && l.owner_discord_id !== discordId && live(l))) grant(LICENSE_PERMISSIONS, "developer");

  return {
    isOwner,
    permissions: new Set(Object.keys(sources).filter(isPermission)),
    sources,
    hasLicense: licenseRows.some((l) => l.owner_discord_id === discordId),
  };
}

/** The signed-in viewer for this request, or null. Deduplicated per render with React cache. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Read the request first: that marks the render as dynamic before any env/DB access.
  const requestHeaders = await headers();
  const session = await auth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const discordId = await discordIdFor(session.user.id);
  if (!discordId) return null; // only Discord sign-ins can exist; anything else gets nothing
  const resolved = await resolvePermissions(discordId);
  return {
    userId: session.user.id,
    discordId,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    ...resolved,
  };
});

export class AccessError extends Error {
  constructor(
    message: string,
    readonly code: "unauthenticated" | "forbidden",
  ) {
    super(message);
  }
}

/** For server actions and route handlers: the viewer, or throws. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AccessError("You need to sign in.", "unauthenticated");
  return viewer;
}

export async function requirePermission(permission: Permission): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.permissions.has(permission)) throw new AccessError("You don't have permission to do that.", "forbidden");
  return viewer;
}

/**
 * Anti-escalation: an actor may only add or remove permissions they hold themselves.
 * Returns the permissions that changed but the actor doesn't hold (empty = allowed).
 */
export function forbiddenChanges(actor: Viewer, before: readonly Permission[], after: readonly Permission[]): Permission[] {
  const changed = ALL_PERMISSIONS.filter((p) => before.includes(p) !== after.includes(p));
  return changed.filter((p) => !actor.permissions.has(p));
}
