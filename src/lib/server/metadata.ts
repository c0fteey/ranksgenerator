import "server-only";
import type { Metadata } from "next";
import { PAGES, type PageId } from "../pages";
import { seoImagePath } from "../seo";
import { siteUrl } from "./env";
import { getSeo } from "./seo";

/**
 * Title, description and link embed for a page, from the settings in Admin → SEO.
 * The home page uses the admin's text as is; other pages put their own name in front.
 */
export async function pageMetadata(page: PageId): Promise<Metadata> {
  const seo = await getSeo();
  const info = PAGES[page];
  const home = page === "home";
  const title = home ? seo.title : `${info.title} · ${seo.siteName || seo.title}`;
  const description = home ? seo.description : info.description;
  const embedTitle = home ? seo.embedTitle || seo.title : title;
  const embedDescription = home ? seo.embedDescription || seo.description : info.description;
  const image = seoImagePath(seo, page);
  // The themed card is drawn for the large layout, at a known size.
  const themed = !!image && image.startsWith("/api/og");
  const large = !!image && (themed || seo.largeImage);

  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    keywords: seo.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    robots: seo.indexable ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical: info.path },
    openGraph: {
      type: "website",
      url: info.path,
      siteName: seo.siteName || undefined,
      title: embedTitle,
      description: embedDescription,
      images: image ? [themed ? { url: image, width: 1200, height: 630, alt: embedTitle } : { url: image, alt: embedTitle }] : undefined,
    },
    twitter: {
      card: large ? "summary_large_image" : "summary",
      title: embedTitle,
      description: embedDescription,
      images: image ? [image] : undefined,
    },
  };
}
