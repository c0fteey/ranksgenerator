import type { PageId } from "./pages";
import { SITE_NAME } from "./site";

// SEO and link-embed settings edited in the admin panel. Shared by the server (metadata) and the
// admin form (preview), so it holds no server-only code.

export type SeoImageMode = "default" | "upload" | "url" | "none";

export interface SeoSettings {
  /** Browser tab and search result title. */
  title: string;
  /** Search result snippet. */
  description: string;
  /** Small line above the embed title (og:site_name). */
  siteName: string;
  /** Embed title; empty uses `title`. */
  embedTitle: string;
  /** Embed text; empty uses `description`. */
  embedDescription: string;
  /** Embed accent bar on Discord (theme-color). */
  color: string;
  imageMode: SeoImageMode;
  imageUrl: string;
  /** Big image under the text instead of a thumbnail on the side. */
  largeImage: boolean;
  keywords: string;
  /** Let search engines index the site. */
  indexable: boolean;
  /** Bumped on every upload so embeds don't keep showing a cached old image. */
  imageVersion: number;
}

export const DEFAULT_SEO: SeoSettings = {
  title: `${SITE_NAME} – Minecraft rank tag generator`,
  description: "Design pixel rank tags for your Minecraft server and download them as PNG.",
  siteName: SITE_NAME,
  embedTitle: "",
  embedDescription: "",
  color: "#e2b33c",
  imageMode: "default",
  imageUrl: "",
  largeImage: true,
  keywords: "minecraft, rank tag, generator, pixel art",
  indexable: true,
  imageVersion: 0,
};

export const SEO_LIMITS = { title: 70, description: 200, siteName: 50, embedTitle: 100, embedDescription: 350, imageUrl: 500, keywords: 300 } as const;

export const SEO_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const SEO_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

const HEX = /^#[0-9a-f]{6}$/i;
const IMAGE_MODES: SeoImageMode[] = ["default", "upload", "url", "none"];

const text = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : fallback);

export const isHttpUrl = (v: string) => {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

/** Untrusted input (form or database row) → valid settings. Unknown or broken fields fall back to defaults. */
export function normalizeSeo(input: unknown): SeoSettings {
  const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_SEO;
  const imageUrl = text(v.imageUrl, SEO_LIMITS.imageUrl, "");
  return {
    title: text(v.title, SEO_LIMITS.title, d.title) || d.title,
    description: text(v.description, SEO_LIMITS.description, d.description),
    siteName: text(v.siteName, SEO_LIMITS.siteName, d.siteName),
    embedTitle: text(v.embedTitle, SEO_LIMITS.embedTitle, d.embedTitle),
    embedDescription: text(v.embedDescription, SEO_LIMITS.embedDescription, d.embedDescription),
    color: typeof v.color === "string" && HEX.test(v.color) ? v.color.toLowerCase() : d.color,
    imageMode: IMAGE_MODES.includes(v.imageMode as SeoImageMode) ? (v.imageMode as SeoImageMode) : d.imageMode,
    imageUrl: isHttpUrl(imageUrl) ? imageUrl : "",
    largeImage: typeof v.largeImage === "boolean" ? v.largeImage : d.largeImage,
    keywords: text(v.keywords, SEO_LIMITS.keywords, d.keywords),
    indexable: typeof v.indexable === "boolean" ? v.indexable : d.indexable,
    imageVersion: Number.isSafeInteger(v.imageVersion) && (v.imageVersion as number) >= 0 ? (v.imageVersion as number) : 0,
  };
}

// Short stable hash so the themed image URL changes when what it draws changes.
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** Path of a page's embed image, relative to the site URL, or null for no image. */
export function seoImagePath(s: SeoSettings, page: PageId = "home"): string | null {
  if (s.imageMode === "none") return null;
  if (s.imageMode === "url" && s.imageUrl) return s.imageUrl;
  if (s.imageMode === "upload" && s.imageVersion > 0) return `/api/seo/image?v=${s.imageVersion}`;
  return `/api/og?page=${page}&v=${hash(`${s.siteName}|${s.color}`)}`;
}
