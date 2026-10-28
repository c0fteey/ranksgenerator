import { Suspense } from "react";
import { AdminPanel, type AdminData } from "@/components/auth/AdminPanel";
import { Gate, PageFallback } from "@/components/auth/Gate";
import { STATIC_ACCOUNT_GRANTS } from "@/lib/access/config";
import { isPermission, type Permission } from "@/lib/access/permissions";
import { ownerIds, type Viewer } from "@/lib/server/access";
import { recentAudit } from "@/lib/server/audit";
import { query } from "@/lib/server/db";
import { getGuildRoles } from "@/lib/server/discord";
import { siteUrl } from "@/lib/server/env";
import { effectiveStatus, namesFor, recentLicenses } from "@/lib/server/licenses";
import { readSeo } from "@/lib/server/seo";
import { pageMetadata } from "@/lib/server/metadata";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
const fmt = (d: Date | null) => (d ? dateFormat.format(d) : null);
const perms = (values: string[] | null | undefined) => (values ?? []).filter(isPermission) as Permission[];
// License keys in the activity log are hidden from admins who can't manage licenses;
// otherwise an unused key could be read off the log and claimed.
const maskKeys = (text: string) => text.replace(/([0-9A-F]{4})(?:-[0-9A-F]{4}){4}-([0-9A-F]{4})/g, "$1-••••-••••-••••-••••-$2");

export const generateMetadata = () => pageMetadata("admin");

export default function AdminPage() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted">Discord role permissions, account access, licenses, SEO and activity.</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <Gate permission="admin.access">{(viewer) => <AdminData viewer={viewer} />}</Gate>
      </Suspense>
    </>
  );
}

// Each section's data is loaded only if the viewer may use that section, so nothing they
// can't manage is ever sent to their browser. The actions re-check on every write anyway.
async function AdminData({ viewer }: { viewer: Viewer }) {
  const canAccess = viewer.permissions.has("access.manage");
  const canLicenses = viewer.permissions.has("licenses.manage");
  const canSeo = viewer.permissions.has("seo.manage");

  const [guildRoles, roleRows, grantRows, licenses, auditRows, seo] = await Promise.all([
    canAccess ? getGuildRoles() : null,
    canAccess ? query<{ role_id: string; permissions: string[] }>(`SELECT role_id, permissions FROM role_permissions`) : [],
    canAccess
      ? query<{ discord_id: string; permissions: string[]; note: string | null; updated_at: Date }>(
          `SELECT discord_id, permissions, note, updated_at FROM account_grants ORDER BY updated_at DESC`,
        )
      : [],
    canLicenses ? recentLicenses() : [],
    recentAudit(100),
    canSeo ? readSeo() : null,
  ]);

  const owners = [...ownerIds()];
  const names = await namesFor([
    ...owners,
    ...grantRows.map((g) => g.discord_id),
    ...Object.keys(STATIC_ACCOUNT_GRANTS),
    ...licenses.flatMap((l) => [l.owner_discord_id, l.developer_discord_id]),
    ...auditRows.map((a) => a.actor),
  ]);
  const safe = (text: string | null) => (text === null || canLicenses ? text : maskKeys(text));
  const nameOf = (id: string | null) => (id ? (names[id]?.name ?? null) : null);
  const roleMap = new Map(roleRows.map((r) => [r.role_id, perms(r.permissions)]));

  const data: AdminData = {
    viewerPermissions: [...viewer.permissions],
    roles: canAccess
      ? {
          available: guildRoles !== null,
          list: (guildRoles ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : null,
            managed: r.managed,
            permissions: roleMap.get(r.id) ?? [],
          })),
        }
      : null,
    accounts: canAccess
      ? {
          owners: owners.map((id) => ({ id, name: nameOf(id) })),
          code: Object.entries(STATIC_ACCOUNT_GRANTS).map(([id, p]) => ({ id, name: nameOf(id), permissions: perms([...p]) })),
          grants: grantRows.map((g) => ({ id: g.discord_id, name: nameOf(g.discord_id), note: g.note, permissions: perms(g.permissions), updatedAt: fmt(g.updated_at)! })),
        }
      : null,
    licenses: canLicenses
      ? licenses.map((l) => ({
          key: l.key,
          status: effectiveStatus(l),
          durationDays: l.duration_days,
          owner: l.owner_discord_id ? { id: l.owner_discord_id, name: nameOf(l.owner_discord_id) } : null,
          developer: l.developer_discord_id ? { id: l.developer_discord_id, name: nameOf(l.developer_discord_id) } : null,
          note: l.note,
          createdAt: fmt(l.created_at)!,
          expiresAt: fmt(l.expires_at),
        }))
      : null,
    seo: seo ? { settings: seo, siteUrl: siteUrl() } : null,
    activity: auditRows.map((a) => ({
      id: a.id,
      actor: a.actor,
      actorName: nameOf(a.actor),
      action: a.action,
      target: safe(a.target),
      details: safe(a.details ? JSON.stringify(a.details) : null),
      at: fmt(a.created_at)!,
    })),
  };
  return <AdminPanel data={data} />;
}
