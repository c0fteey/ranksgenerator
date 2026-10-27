import { Suspense } from "react";
import { connection } from "next/server";
import { ErrorScreen } from "@/components/ErrorScreen";
import { missingEnv } from "@/lib/config";

// Shown (via the proxy) while required environment variables are missing.
export default function SetupPage() {
  return (
    <Suspense>
      <SetupNotice />
    </Suspense>
  );
}

async function SetupNotice() {
  await connection(); // read env at request time, not at build
  const missing = missingEnv();
  // Variable names only (never values), and only in development.
  const detail = process.env.NODE_ENV === "development" && missing.length ? ` Missing: ${missing.join(", ")}. See .env.example.` : "";
  return (
    <ErrorScreen
      code={503}
      title="Site setup incomplete"
      message={`The server is missing required configuration, so sign-in is unavailable right now.${detail}`}
    />
  );
}
