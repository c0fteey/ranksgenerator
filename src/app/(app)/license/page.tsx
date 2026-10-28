import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageFallback } from "@/components/auth/Gate";
import { CopyButton, DeveloperAccess } from "@/components/auth/LicenseControls";
import { getViewer } from "@/lib/server/access";
import { effectiveStatus, licenseOwnedBy, namesFor, type LicenseStatus } from "@/lib/server/licenses";
import { pageMetadata } from "@/lib/server/metadata";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });

export const generateMetadata = () => pageMetadata("license");

export default function LicensePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">License</h1>
        <p className="mt-1 text-sm text-muted">Your license details and developer access.</p>
      </div>
      <Suspense fallback={<PageFallback />}>
        <LicenseDetails />
      </Suspense>
    </div>
  );
}

const STATUS_STYLE: Record<LicenseStatus, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  expired: "border-red-500/40 bg-red-500/10 text-red-400",
  revoked: "border-red-500/40 bg-red-500/10 text-red-400",
  unused: "border-line bg-raised text-muted",
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${className}`}>{children}</span>;
}

async function LicenseDetails() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  // Only the license owner sees this page; developers and role-based users don't.
  const license = await licenseOwnedBy(viewer.discordId);
  if (!license) redirect("/");

  const status = effectiveStatus(license);
  const names = await namesFor([license.developer_discord_id]);
  const developer = license.developer_discord_id ? { id: license.developer_discord_id, name: names[license.developer_discord_id]?.name ?? null } : null;

  return (
    <>
      <section className="card flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex flex-col gap-2">
          <span className="label">License key</span>
          <div className="flex items-center gap-3">
            <input readOnly value={license.key} aria-label="License key" className="input rounded-full px-5 py-3 font-mono tracking-wide" />
            <CopyButton value={license.key} />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="label">Status</span>
            <Badge className={STATUS_STYLE[status]}>{status}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label">Expiry</span>
            {license.expires_at ? (
              <span className="text-sm font-medium">{dateFormat.format(license.expires_at)}</span>
            ) : (
              <Badge className="border-gold/40 bg-gold/10 text-gold">Lifetime</Badge>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="label">Activated</span>
            <span className="text-sm font-medium">{license.activated_at ? dateFormat.format(license.activated_at) : "—"}</span>
          </div>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-6 sm:p-7">
        <div>
          <h2 className="font-semibold">Developer Access</h2>
          <p className="mt-1 text-sm text-muted">
            Give one other Discord account access to the generator under your license. They can use it, but won&apos;t see this page.
          </p>
        </div>
        <DeveloperAccess developer={developer} disabled={status !== "active"} />
        <p className="text-xs leading-relaxed text-muted">
          Find a Discord user ID by enabling Developer Mode in Discord (Settings → Advanced), then right-click a user and choose &quot;Copy User ID&quot;.
        </p>
      </section>
    </>
  );
}
