"use client";

import { useEffect } from "react";
import { ErrorScreen, describeError } from "@/components/ErrorScreen";
import { InlineScript } from "@/components/InlineScript";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

// Replaces the root layout when it fails, so it brings its own document, styles and theme.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  const info = describeError(error);
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_SCRIPT} />
        <title>{`${info.code} – ${info.title}`}</title>
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <ErrorScreen {...info} digest={error.digest} retry={retry} />
      </body>
    </html>
  );
}
