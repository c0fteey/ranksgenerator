import { redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { LICENSE_PERMISSIONS, type Permission } from "@/lib/access/permissions";
import { getViewer, type Viewer } from "@/lib/server/access";
import { LicenseRequired } from "./LicenseRequired";

/**
 * Server-side page guard. Renders `children` only when the viewer holds `permission`.
 * Must sit inside a <Suspense> boundary (it reads the request).
 */
export async function Gate({ permission, children }: { permission: Permission; children: (viewer: Viewer) => React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.permissions.has(permission)) return children(viewer);
  // Things a license unlocks ask for one; anything else is simply off limits.
  return LICENSE_PERMISSIONS.includes(permission) ? <LicenseRequired /> : <NoAccess />;
}

export function NoAccess() {
  return (
    <div className="card mx-auto mt-10 flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <span className="bg-gradient-to-b from-gold-soft to-gold bg-clip-text text-6xl font-bold tracking-tight text-transparent">403</span>
      <span className="grid size-12 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
        <ShieldOff className="size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-bold">No access</h1>
      <p className="text-sm leading-relaxed text-muted">Your account doesn&apos;t have permission to view this page. If you think it should, ask a site admin.</p>
    </div>
  );
}

export function PageFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-raised" />
      <div className="h-48 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
