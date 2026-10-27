import "server-only";
import { env } from "./env";

const API = "https://discord.com/api/v10";
const ROLE_TTL_MS = 60_000;

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

async function bot<T>(path: string): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}` },
    cache: "no-store",
  });
  if (!res.ok) return { status: res.status, data: null };
  return { status: res.status, data: (await res.json()) as T };
}

// Short per-instance cache so a page render doesn't hit Discord for every check.
// A removed role stops granting access within ROLE_TTL_MS.
const roleCache = new Map<string, { roles: string[]; at: number }>();

/**
 * Role IDs the user holds in the configured guild. Fails closed: not a member, bot not
 * configured, or Discord unreachable all mean "no roles", never an error that grants access.
 */
export async function getMemberRoles(discordId: string): Promise<string[]> {
  const hit = roleCache.get(discordId);
  if (hit && Date.now() - hit.at < ROLE_TTL_MS) return hit.roles;
  let roles: string[] = [];
  try {
    const { status, data } = await bot<{ roles: string[] }>(`/guilds/${env("DISCORD_GUILD_ID")}/members/${discordId}`);
    if (data && Array.isArray(data.roles)) roles = data.roles.filter((r) => typeof r === "string");
    else if (status !== 404) console.error(`Discord member lookup failed (${status}) for ${discordId}`);
  } catch (err) {
    console.error("Discord member lookup error", err);
    return []; // don't cache transient failures
  }
  roleCache.set(discordId, { roles, at: Date.now() });
  return roles;
}

/** All roles of the guild, highest first; null when the bot can't read them. */
export async function getGuildRoles(): Promise<GuildRole[] | null> {
  try {
    const { data } = await bot<GuildRole[]>(`/guilds/${env("DISCORD_GUILD_ID")}/roles`);
    return data ? data.sort((a, b) => b.position - a.position) : null;
  } catch (err) {
    console.error("Discord roles lookup error", err);
    return null;
  }
}
