"use server";

import { headers } from "next/headers";
import {
  applyLocally,
  applyOnVercel,
  generateSecrets,
  isConfigured,
  migrate,
  setupMode,
  testBot,
  testDatabase,
  testDiscordApp,
  verifySetupToken,
} from "@/lib/server/setup";

type Result = { ok: boolean; message: string; detail?: string };
export type SetupResult = Result | null;

/** Every action re-checks: wizard still open, and (on Vercel) the setup token. */
async function guard(token: unknown): Promise<Result | "local" | "vercel"> {
  if (isConfigured()) return { ok: false, message: "This site is already set up. The wizard is closed." };
  const mode = setupMode((await headers()).get("host"));
  if (mode.kind === "blocked") return { ok: false, message: "The setup wizard isn't available here." };
  if (mode.kind === "local") return "local";
  const check = await verifySetupToken(token);
  if (check === "locked") return { ok: false, message: "Too many wrong attempts. Wait 10 minutes and try again." };
  if (check === "invalid") return { ok: false, message: "Wrong setup token." };
  return "vercel";
}

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function unlockSetup(token: unknown): Promise<SetupResult> {
  const g = await guard(token);
  return typeof g === "string" ? { ok: true, message: "Unlocked." } : g;
}

export async function checkDatabaseStep(token: unknown, url: unknown): Promise<SetupResult> {
  const g = await guard(token);
  if (typeof g !== "string") return g;
  const error = await testDatabase(str(url, 2000));
  return error ? { ok: false, message: error } : { ok: true, message: "Connected to the database." };
}

export async function checkDiscordStep(token: unknown, clientId: unknown, clientSecret: unknown): Promise<SetupResult> {
  const g = await guard(token);
  if (typeof g !== "string") return g;
  const error = await testDiscordApp(str(clientId), str(clientSecret));
  return error ? { ok: false, message: error } : { ok: true, message: "Discord accepted the app credentials." };
}

export async function checkBotStep(token: unknown, botToken: unknown, guildId: unknown): Promise<SetupResult> {
  const g = await guard(token);
  if (typeof g !== "string") return g;
  const result = await testBot(str(botToken), str(guildId));
  if (result.error) return { ok: false, message: result.error };
  return { ok: true, message: `Bot ${result.botName} can see ${result.guildName}.` };
}

export interface SetupValues {
  databaseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  botToken?: string;
  guildId?: string;
  siteUrl?: string;
}

/**
 * Re-validates everything server side (earlier step checks are not trusted), creates the tables,
 * then saves the settings. Values already present in the environment are kept as they are.
 */
export async function finishSetup(token: unknown, input: SetupValues): Promise<Result & { botApiSecret?: string }> {
  const g = await guard(token);
  if (typeof g !== "string") return g;
  const env = process.env;
  const v = {
    DATABASE_URL: env.DATABASE_URL || str(input?.databaseUrl, 2000),
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID || str(input?.clientId),
    DISCORD_CLIENT_SECRET: env.DISCORD_CLIENT_SECRET || str(input?.clientSecret),
    DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN || str(input?.botToken),
    DISCORD_GUILD_ID: env.DISCORD_GUILD_ID || str(input?.guildId),
    BETTER_AUTH_URL: env.BETTER_AUTH_URL || str(input?.siteUrl).replace(/\/+$/, ""),
  };

  const dbError = await testDatabase(v.DATABASE_URL);
  if (dbError) return { ok: false, message: dbError };
  const appError = await testDiscordApp(v.DISCORD_CLIENT_ID, v.DISCORD_CLIENT_SECRET);
  if (appError) return { ok: false, message: appError };
  if (v.DISCORD_BOT_TOKEN || v.DISCORD_GUILD_ID) {
    const bot = await testBot(v.DISCORD_BOT_TOKEN, v.DISCORD_GUILD_ID);
    if (bot.error) return { ok: false, message: bot.error };
  }
  if (!/^https?:\/\/[^/\s]+$/.test(v.BETTER_AUTH_URL)) return { ok: false, message: "The site address must look like https://example.com" };

  try {
    await migrate(v.DATABASE_URL);
  } catch (err) {
    return { ok: false, message: "Creating the database tables failed.", detail: err instanceof Error ? err.message : undefined };
  }

  const secrets = generateSecrets();
  // Only write what isn't already set in the environment.
  const toSave: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...v, ...secrets })) {
    if (value && !env[key]) toSave[key] = value;
  }
  const botApiSecret = env.BOT_API_SECRET ? undefined : secrets.BOT_API_SECRET;

  if (g === "local") {
    await applyLocally(toSave);
    return { ok: true, message: "Saved to .env.local. The dev server reloads it automatically.", botApiSecret };
  }
  const applied = await applyOnVercel(toSave);
  if (!applied.ok) return { ok: false, message: applied.error };
  return {
    ok: true,
    message: applied.redeployed
      ? "Settings saved and a new deployment has started. The site opens in about a minute."
      : "Settings saved. Open Vercel → Deployments and redeploy the latest one to apply them.",
    botApiSecret,
  };
}
