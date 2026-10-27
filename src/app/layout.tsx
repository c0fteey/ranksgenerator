import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

// Self-hosted by next/font (served from /_next/static/media).
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: `${SITE_NAME} – Minecraft rank tag generator`,
  description: "Design pixel rank tags for your Minecraft server and download them as PNG.",
};

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
