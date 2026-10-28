import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLinks, type NavItem } from "@/components/auth/NavLinks";
import { UserMenu } from "@/components/auth/UserMenu";
import { COPYRIGHT_YEAR, SITE_NAME } from "@/lib/site";
import { getViewer } from "@/lib/server/access";

// Signed-in shell. The header and sidebar are static; the parts that depend on the viewer
// stream in behind their own Suspense boundaries so the page never waits on the session.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-line bg-bg/80 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold tracking-tight text-gold">{SITE_NAME}</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <Suspense fallback={<div className="h-10 w-40 animate-pulse rounded-full bg-raised" />}>
            <ViewerMenu />
          </Suspense>
        </div>
      </header>
      {/* Phones and small tablets: the sidebar is hidden, so the same links sit under the header. */}
      <nav className="sticky top-16 z-30 flex gap-1 overflow-x-auto border-b border-line bg-bg/80 px-3 py-2 backdrop-blur [scrollbar-width:none] md:hidden">
        <Suspense fallback={<NavLinks items={BASE_NAV} />}>
          <ViewerNav />
        </Suspense>
      </nav>
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-line p-4 md:block">
          <nav className="sticky top-20 flex flex-col gap-1">
            <Suspense fallback={<NavLinks items={BASE_NAV} />}>
              <ViewerNav />
            </Suspense>
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">{children}</main>
          <footer className="mt-auto py-8 text-center text-sm text-muted">
            © {COPYRIGHT_YEAR} {SITE_NAME}. All rights reserved.
          </footer>
        </div>
      </div>
    </>
  );
}

const BASE_NAV: NavItem[] = [
  { href: "/", label: "Generator", icon: "generator" },
  { href: "/history", label: "History", icon: "history" },
];

async function ViewerMenu() {
  const viewer = await getViewer();
  return viewer ? <UserMenu name={viewer.name} email={viewer.email} image={viewer.image} /> : null;
}

async function ViewerNav() {
  const viewer = await getViewer();
  const items = [...BASE_NAV];
  if (viewer?.hasLicense) items.push({ href: "/license", label: "License", icon: "license" });
  if (viewer?.permissions.has("admin.access")) items.push({ href: "/admin", label: "Admin", icon: "admin" });
  return <NavLinks items={items} />;
}
