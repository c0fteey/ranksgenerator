import { connection } from "next/server";
import { readSeoImage } from "@/lib/server/seo";

// The uploaded embed image. Public: Discord and other crawlers fetch it without a session.
// URLs carry ?v=<version>, so a new upload gets a new URL and old copies can be cached long.
export async function GET() {
  await connection();
  const image = await readSeoImage();
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
