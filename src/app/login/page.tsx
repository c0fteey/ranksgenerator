import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SignInButton } from "@/components/auth/SignInButton";
import { getViewer } from "@/lib/server/access";
import { COPYRIGHT_YEAR, SITE_NAME } from "@/lib/site";
import { pageMetadata } from "@/lib/server/metadata";

export const generateMetadata = () => pageMetadata("login");

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <div className="card flex w-full max-w-md flex-col items-center gap-6 p-8 text-center sm:p-10">
        <Logo size={64} />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to {SITE_NAME}</h1>
          <p className="text-sm text-muted">The ultimate tool for creating Minecraft rank tags.</p>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <div className="flex w-full flex-col gap-4">
          <SignInButton />
          <Suspense>
            <SignInError searchParams={searchParams} />
          </Suspense>
          <p className="text-xs leading-relaxed text-muted">
            By signing in, you agree to our Terms of Service. In order to use our services you have to have a valid license key.
          </p>
        </div>
      </div>
      <p className="text-sm text-muted">
        © {COPYRIGHT_YEAR} {SITE_NAME}. All rights reserved.
      </p>
    </main>
  );
}

async function RedirectIfSignedIn() {
  if (await getViewer()) redirect("/");
  return null;
}

async function SignInError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
      Sign-in failed or was cancelled. Please try again.
    </p>
  );
}
