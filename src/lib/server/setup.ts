import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { missingEnv } from "../config";

// First-run setup from the browser. Only usable while required configuration is missing, so a
// configured site can never be reconfigured through it (even with a leaked setup token).
//
// - On Vercel: the owner sets SETUP_TOKEN (password for the wizard) and VERCEL_TOKEN (API access)
//   once in the dashboard; the wizard writes the rest through the Vercel API and redeploys.
// - Locally (next dev on localhost): no token; values go to .env.local.

export type SetupMode = { kind: "vercel" } | { kind: "local" } | { kind: "blocked"; reason: string };

export const isConfigured = () => missingEnv().length === 0;

export function setupMode(host: string | null): SetupMode {
  if (process.env.VERCEL) {
    if (!process.env.VERCEL_TOKEN) return { kind: "blocked", reason: "missing-vercel-token" };
    if ((process.env.SETUP_TOKEN ?? "").length < 16) return { kind: "blocked", reason: "missing-setup-token" };
    return { kind: "vercel" };
  }
  const local = !!host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (process.env.NODE_ENV === "development" && local) return { kind: "local" };
  return { kind: "blocked", reason: "not-local" };
}

// --- Setup token (Vercel) -------------------------------------------------------------------

const failures: number[] = [];
const MAX_FAILURES = 10;
const WINDOW_MS = 10 * 60_000;

/** Constant-time token check with a per-instance lockout after repeated failures. */
export async function verifySetupToken(given: unknown): Promise<"ok" | "invalid" | "locked"> {
  const now = Date.now();
  while (failures.length && now - failures[0] > WINDOW_MS) failures.shift();
  if (failures.length >= MAX_FAILURES) return "locked";
  const digest = (s: string) => createHash("sha256").update(s).digest();
  const ok = typeof given === "string" && timingSafeEqual(digest(given), digest(process.env.SETUP_TOKEN ?? ""));
  if (ok) return "ok";
  failures.push(now);
  await new Promise((r) => setTimeout(r, 600)); // slow down guessing
  return "invalid";
}

// --- Checks ---------------------------------------------------------------------------------

export const isSnowflake = (v: unknown): v is string => typeof v === "string" && /^\d{17,20}$/.test(v);

export async function testDatabase(url: string): Promise<string | null> {
  if (!/^postgres(ql)?:\/\//.test(url)) return "The address must start with postgresql://";
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000, max: 1 });
  try {
    await pool.query("SELECT 1");
    return null;
  } catch (err) {
    return `Couldn't connect: ${err instanceof Error ? err.message : "unknown error"}`;
  } finally {
    await pool.end().catch(() => {});
  }
}

/** Valid client ID + secret pass Discord's client-credentials grant. */
export async function testDiscordApp(clientId: string, clientSecret: string): Promise<string | null> {
  if (!isSnowflake(clientId)) return "The Client ID is a 17–20 digit number.";
  try {
    const res = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "identify" }),
      cache: "no-store",
    });
    return res.ok ? null : "Discord rejected this Client ID / Client Secret pair.";
  } catch {
    return "Couldn't reach Discord. Try again.";
  }
}

async function discordBot<T>(route: string, botToken: string): Promise<T | null> {
  try {
    const res = await fetch(`https://discord.com/api/v10${route}`, { headers: { Authorization: `Bot ${botToken}` }, cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function testBot(botToken: string, guildId: string): Promise<{ error: string | null; botName?: string; guildName?: string }> {
  const me = await discordBot<{ username: string }>("/users/@me", botToken);
  if (!me) return { error: "Discord didn't accept this bot token." };
  if (!isSnowflake(guildId)) return { error: "The server ID is a 17–20 digit number.", botName: me.username };
  const guild = await discordBot<{ name: string }>(`/guilds/${guildId}`, botToken);
  if (!guild) return { error: `${me.username} can't see that server. Invite the bot first, then check again.`, botName: me.username };
  return { error: null, botName: me.username, guildName: guild.name };
}

// --- Apply ----------------------------------------------------------------------------------

/** Better Auth tables + db/schema.sql (same as scripts/migrate.mjs). */
export async function migrate(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const { runMigrations } = await getMigrations({ database: pool });
    await runMigrations();
    await pool.query(await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8"));
  } finally {
    await pool.end().catch(() => {});
  }
}

export const generateSecrets = () => ({
  BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
  BOT_API_SECRET: randomBytes(32).toString("hex"),
});

const VERCEL_API = "https://api.vercel.com";

async function vercel<T>(route: string, init: RequestInit = {}, teamId?: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const url = new URL(VERCEL_API + route);
  if (teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, data: res.ok ? ((await res.json()) as T) : null };
}

/** Find this project (and its team) from what Vercel exposes at runtime. */
async function findProject(): Promise<{ id: string; name: string; teamId?: string } | null> {
  const explicitTeam = process.env.VERCEL_TEAM_ID;
  const candidates: { id: string; teamId?: string }[] = [];
  if (process.env.VERCEL_PROJECT_ID) candidates.push({ id: process.env.VERCEL_PROJECT_ID, teamId: explicitTeam });

  // The OIDC token (on by default) carries project_id and owner_id claims.
  const oidc = process.env.VERCEL_OIDC_TOKEN?.split(".")[1];
  if (oidc) {
    try {
      const claims = JSON.parse(Buffer.from(oidc, "base64url").toString()) as { project_id?: string; owner_id?: string };
      if (claims.project_id) candidates.push({ id: claims.project_id, teamId: claims.owner_id?.startsWith("team_") ? claims.owner_id : explicitTeam });
    } catch {
      // not a JWT; ignore
    }
  }
  if (process.env.VERCEL_GIT_REPO_SLUG) candidates.push({ id: process.env.VERCEL_GIT_REPO_SLUG, teamId: explicitTeam });

  const teams = (await vercel<{ teams: { id: string }[] }>("/v2/teams")).data?.teams.map((t) => t.id) ?? [];
  for (const c of candidates) {
    for (const teamId of [c.teamId, undefined, ...teams].filter((t, i, all) => all.indexOf(t) === i)) {
      const res = await vercel<{ id: string; name: string }>(`/v9/projects/${encodeURIComponent(c.id)}`, {}, teamId);
      if (res.data) return { id: res.data.id, name: res.data.name, teamId };
    }
  }
  return null;
}

export type ApplyResult = { ok: true; redeployed: boolean } | { ok: false; error: string };

/** Store env vars in the Vercel project and start a production redeploy. */
export async function applyOnVercel(values: Record<string, string>): Promise<ApplyResult> {
  const project = await findProject();
  if (!project) return { ok: false, error: "Couldn't find this project with VERCEL_TOKEN. Check the token's scope (it must include this project's team)." };

  const body = Object.entries(values).map(([key, value]) => ({ key, value, type: "encrypted", target: ["production", "preview"] }));
  const saved = await vercel(`/v10/projects/${project.id}/env?upsert=true`, { method: "POST", body: JSON.stringify(body) }, project.teamId);
  if (!saved.ok) return { ok: false, error: `Vercel refused to save the settings (HTTP ${saved.status}).` };

  // Redeploy the current production deployment so the new variables take effect.
  let deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  if (!deploymentId) {
    const list = await vercel<{ deployments: { uid: string }[] }>(`/v6/deployments?projectId=${project.id}&target=production&limit=1`, {}, project.teamId);
    deploymentId = list.data?.deployments[0]?.uid;
  }
  if (!deploymentId) return { ok: true, redeployed: false };
  const redeploy = await vercel(
    `/v13/deployments?forceNew=1`,
    { method: "POST", body: JSON.stringify({ name: project.name, deploymentId, target: "production" }) },
    project.teamId,
  );
  return { ok: true, redeployed: redeploy.ok };
}

/** Merge values into .env.local (local development only). */
export async function applyLocally(values: Record<string, string>) {
  const file = path.join(process.cwd(), ".env.local");
  const lines = (await readFile(file, "utf8").catch(() => "")).split(/\r?\n/);
  const pending = new Map(Object.entries(values));
  const quote = (v: string) => (/[\s#"]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v);
  const out = lines.map((line) => {
    const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
    if (!key || !pending.has(key)) return line;
    const value = pending.get(key)!;
    pending.delete(key);
    return `${key}=${quote(value)}`;
  });
  for (const [key, value] of pending) out.push(`${key}=${quote(value)}`);
  await writeFile(file, out.join("\n").replace(/\n*$/, "\n"));
}
