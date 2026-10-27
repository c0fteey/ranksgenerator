import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The setup wizard creates tables from this file at runtime.
  outputFileTracingIncludes: { "/setup": ["./db/schema.sql"] },
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
