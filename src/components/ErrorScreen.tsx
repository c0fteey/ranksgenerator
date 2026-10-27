"use client";

import Link from "next/link";
import { Home, RotateCw } from "lucide-react";

// Shared look for every error page: big status code, what happened, and a way out.
export function ErrorScreen({
  code,
  title,
  message,
  digest,
  retry,
}: {
  code: number | string;
  title: string;
  message: string;
  digest?: string;
  /** Re-render the failed part; defaults to reloading the page. */
  retry?: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card flex w-full max-w-md flex-col items-center gap-5 p-8 text-center sm:p-10">
        <span className="bg-gradient-to-b from-gold-soft to-gold bg-clip-text text-7xl font-bold tracking-tight text-transparent sm:text-8xl">{code}</span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm leading-relaxed text-muted">{message}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => (retry ? retry() : window.location.reload())} className="btn-gold flex-1 rounded-full">
            <RotateCw className="size-4" aria-hidden />
            Try again
          </button>
          <Link href="/" className="btn flex-1 rounded-full">
            <Home className="size-4" aria-hidden />
            Go home
          </Link>
        </div>
        {digest && <p className="font-mono text-[11px] text-muted">Error ID: {digest}</p>}
      </div>
    </main>
  );
}

/** Pick a status code and explanation for an error thrown during rendering. */
export function describeError(error: unknown): { code: number; title: string; message: string } {
  const msg = error instanceof Error ? error.message : "";
  if (/failed to fetch|network|load failed|chunk/i.test(msg))
    return { code: 503, title: "Connection problem", message: "We couldn't reach the server. Check your internet connection and try again." };
  return {
    code: 500,
    title: "Something went wrong",
    message: "An unexpected error happened on our side. Trying again usually fixes it; if it keeps happening, let us know with the error ID below.",
  };
}
