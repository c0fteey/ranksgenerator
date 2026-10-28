"use server";

import { revalidatePath, updateTag } from "next/cache";
import { AccessError, requirePermission } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { SEO_TAG, readSeo, writeSeo, writeSeoImage } from "@/lib/server/seo";
import { SEO_IMAGE_MAX_BYTES, SEO_IMAGE_TYPES, normalizeSeo, type SeoSettings } from "@/lib/seo";
import type { ActionResult } from "./license";

type SeoResult = ActionResult & { settings?: SeoSettings };

async function guarded(run: () => Promise<SeoResult>): Promise<SeoResult> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof AccessError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

const refresh = () => {
  updateTag(SEO_TAG);
  revalidatePath("/", "layout");
};

export async function saveSeoAction(input: unknown): Promise<SeoResult> {
  return guarded(async () => {
    const actor = await requirePermission("seo.manage");
    const before = await readSeo();
    // The image version only changes on upload; the form can't set it.
    const settings = normalizeSeo({ ...(input as object), imageVersion: before.imageVersion });
    if (settings.imageMode === "upload" && settings.imageVersion === 0) return { ok: false, message: "Upload an image first." };
    if (settings.imageMode === "url" && !settings.imageUrl) return { ok: false, message: "Enter an image URL starting with http:// or https://." };
    await writeSeo(settings, actor.discordId);
    await audit(actor.discordId, "seo.update", null, { title: settings.title, imageMode: settings.imageMode });
    refresh();
    return { ok: true, message: "SEO settings saved. New links show it right away; Discord may cache old links for a while.", settings };
  });
}

// Checked against the file's first bytes, not just the type the browser claims.
const SIGNATURES: Record<(typeof SEO_IMAGE_TYPES)[number], (b: Buffer) => boolean> = {
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b.subarray(0, 4).toString("latin1") === "GIF8",
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
};

export async function uploadSeoImageAction(form: FormData): Promise<SeoResult> {
  return guarded(async () => {
    const actor = await requirePermission("seo.manage");
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image." };
    if (file.size > SEO_IMAGE_MAX_BYTES) return { ok: false, message: "The image must be 4 MB or smaller." };
    const type = SEO_IMAGE_TYPES.find((t) => t === file.type);
    const data = Buffer.from(await file.arrayBuffer());
    if (!type || !SIGNATURES[type](data)) return { ok: false, message: "Use a PNG, JPG, WEBP or GIF image." };

    await writeSeoImage(type, data);
    const before = await readSeo();
    const settings = normalizeSeo({ ...before, imageMode: "upload", imageVersion: before.imageVersion + 1 });
    await writeSeo(settings, actor.discordId);
    await audit(actor.discordId, "seo.image", null, { type, bytes: data.length });
    refresh();
    return { ok: true, message: "Image uploaded and set as the embed image.", settings };
  });
}
