import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // SEO embed image uploads (4 MB max, plus multipart overhead).
    serverActions: { bodySizeLimit: "5mb" },
  },
  // The setup wizard creates tables from this file at runtime.
  // The embed image route draws the logo.
  outputFileTracingIncludes: { "/setup": ["./db/schema.sql"], "/api/og": ["./public/logo.png"] },
  images: {
    // Discord avatars in the header.
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com", pathname: "/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
