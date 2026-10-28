import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { pageMetadata } from "@/lib/server/metadata";
import { getSeo } from "@/lib/server/seo";
import "./globals.css";

// Self-hosted by next/font (served from /_next/static/media).
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

// Edited in Admin → SEO. getSeo() is cached and refreshed when the settings are saved.
// Pages override this with their own pageMetadata(); this is the fallback (e.g. the 404 page).
export const generateMetadata = (): Promise<Metadata> => pageMetadata("home");

export async function generateViewport(): Promise<Viewport> {
  const seo = await getSeo();
  return { themeColor: seo.color };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script changes data-theme before hydration.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
