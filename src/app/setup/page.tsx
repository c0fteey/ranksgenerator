import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SetupBlocked, SetupWizard, type EnvPresence } from "@/components/setup/SetupWizard";
import { missingEnv } from "@/lib/config";
import { isConfigured, setupMode } from "@/lib/server/setup";

// Shown (via the proxy) while required environment variables are missing.
export default function SetupPage() {
  return (
    <Suspense>
      <Setup />
    </Suspense>
  );
}

async function Setup() {
  await connection(); // read env at request time, not at build
  if (isConfigured()) redirect("/");
  const h = await headers();
  const host = h.get("host");
  const mode = setupMode(host);
  if (mode.kind === "blocked") return <SetupBlocked reason={mode.reason} />;

  const env = process.env;
  // Which settings already exist (e.g. DATABASE_URL added by the Vercel Neon integration). Booleans only.
  const has: EnvPresence = {
    database: !!env.DATABASE_URL,
    discordApp: !!env.DISCORD_CLIENT_ID && !!env.DISCORD_CLIENT_SECRET,
    bot: !!env.DISCORD_BOT_TOKEN && !!env.DISCORD_GUILD_ID,
    siteUrl: !!env.BETTER_AUTH_URL,
  };
  const proto = h.get("x-forwarded-proto") ?? (mode.kind === "local" ? "http" : "https");
  // Variable names only, never values.
  return <SetupWizard mode={mode.kind} has={has} missing={missingEnv()} defaultSiteUrl={host ? `${proto}://${host}` : ""} />;
}
