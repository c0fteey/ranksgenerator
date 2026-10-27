"use server";

import { revalidatePath } from "next/cache";
import { isDiscordId } from "@/lib/access/permissions";
import { AccessError, requireViewer } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { activateLicense, effectiveStatus, licenseOwnedBy, setDeveloper } from "@/lib/server/licenses";

export type ActionResult = { ok: boolean; message: string } | null;

async function guarded(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof AccessError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function activateLicenseAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const viewer = await requireViewer();
    const key = String(form.get("key") ?? "").slice(0, 64);
    const result = await activateLicense(viewer.discordId, key);
    if (!result.ok) {
      await audit(viewer.discordId, "license.activate_failed", null, { reason: result.error });
      return { ok: false, message: result.error };
    }
    await audit(viewer.discordId, "license.activate", result.license.key);
    revalidatePath("/", "layout");
    return { ok: true, message: "License activated." };
  });
}

/** The caller's own live license; only its owner may manage the developer seat. */
async function ownLiveLicense() {
  const viewer = await requireViewer();
  const license = await licenseOwnedBy(viewer.discordId);
  if (!license || effectiveStatus(license) !== "active") throw new AccessError("You need an active license to do that.", "forbidden");
  return { viewer, license };
}

export async function addDeveloperAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const { viewer, license } = await ownLiveLicense();
    const developerId = String(form.get("discordId") ?? "").trim();
    if (!isDiscordId(developerId)) return { ok: false, message: "Enter a valid Discord user ID (17–20 digits)." };
    if (developerId === viewer.discordId) return { ok: false, message: "You already have access with your own license." };
    if (license.developer_discord_id) return { ok: false, message: "Remove the current developer first." };
    await setDeveloper(license.id, developerId);
    await audit(viewer.discordId, "license.developer_add", license.key, { developer: developerId });
    revalidatePath("/license");
    return { ok: true, message: "Developer added." };
  });
}

export async function removeDeveloperAction(): Promise<ActionResult> {
  return guarded(async () => {
    const { viewer, license } = await ownLiveLicense();
    if (!license.developer_discord_id) return { ok: false, message: "There is no developer to remove." };
    await setDeveloper(license.id, null);
    await audit(viewer.discordId, "license.developer_remove", license.key, { developer: license.developer_discord_id });
    revalidatePath("/license");
    return { ok: true, message: "Developer removed." };
  });
}
