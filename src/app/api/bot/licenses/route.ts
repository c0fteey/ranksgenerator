import { createHash, timingSafeEqual } from "node:crypto";
import { isDiscordId } from "@/lib/access/permissions";
import { audit } from "@/lib/server/audit";
import { createLicense, effectiveStatus, findLicenses, isLicenseKey, normalizeKey, revokeLicense, type License } from "@/lib/server/licenses";

// License API for the Discord bot. Every request needs `Authorization: Bearer <BOT_API_SECRET>`.
//
//   POST   /api/bot/licenses   { durationDays?: number | null, note?: string, assignTo?: "<discord id>" }
//   GET    /api/bot/licenses?key=XXXX-...   or   ?discordId=123...
//   DELETE /api/bot/licenses?key=XXXX-...   (revoke)

const BOT_ACTOR = "bot";

function authorized(req: Request): boolean {
  const secret = process.env.BOT_API_SECRET;
  if (!secret || secret.length < 32) return false; // unset or weak secret: API stays closed
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Compare digests so length differences don't leak through timing.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const unauthorized = () => json({ error: "unauthorized" }, 401);

const view = (l: License) => ({
  key: l.key,
  status: effectiveStatus(l),
  durationDays: l.duration_days,
  owner: l.owner_discord_id,
  developer: l.developer_discord_id,
  note: l.note,
  createdAt: l.created_at,
  activatedAt: l.activated_at,
  expiresAt: l.expires_at,
  revokedAt: l.revoked_at,
});

export async function POST(req: Request) {
  if (!authorized(req)) return unauthorized();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "invalid JSON body" }, 400);

  const days = body.durationDays == null ? null : Number(body.durationDays);
  if (days !== null && !(Number.isInteger(days) && days >= 1 && days <= 3650)) return json({ error: "durationDays must be 1-3650 or null" }, 400);
  const assignTo = body.assignTo == null || body.assignTo === "" ? null : body.assignTo;
  if (assignTo !== null && !isDiscordId(assignTo)) return json({ error: "assignTo must be a Discord user ID" }, 400);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 100) || null : null;

  try {
    const license = await createLicense({ durationDays: days, note, createdBy: BOT_ACTOR, assignTo });
    await audit(BOT_ACTOR, "license.create", license.key, { durationDays: days, note, assignTo });
    return json({ license: view(license) }, 201);
  } catch (err) {
    console.error(err);
    return json({ error: assignTo ? "could not create license (the account may already have an active license)" : "could not create license" }, 409);
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  const params = new URL(req.url).searchParams;
  const key = params.get("key");
  const discordId = params.get("discordId");
  if (key && !isLicenseKey(normalizeKey(key))) return json({ error: "invalid key" }, 400);
  if (discordId && !isDiscordId(discordId)) return json({ error: "invalid discordId" }, 400);
  if (!key && !discordId) return json({ error: "pass ?key= or ?discordId=" }, 400);
  const licenses = await findLicenses({ key: key ?? undefined, discordId: discordId ?? undefined });
  return json({ licenses: licenses.map(view) });
}

export async function DELETE(req: Request) {
  if (!authorized(req)) return unauthorized();
  const key = new URL(req.url).searchParams.get("key");
  if (!key || !isLicenseKey(normalizeKey(key))) return json({ error: "invalid key" }, 400);
  const license = await revokeLicense(key, BOT_ACTOR);
  if (!license) return json({ error: "not found or already revoked" }, 404);
  await audit(BOT_ACTOR, "license.revoke", license.key, { owner: license.owner_discord_id });
  return json({ license: view(license) });
}
