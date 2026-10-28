import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { connection, type NextRequest } from "next/server";
import { PAGES, isPageId } from "@/lib/pages";
import { getSeo } from "@/lib/server/seo";

// Default link embed image: logo and site name at the top, the page name large in the accent
// color, its description underneath, on a light grid with a soft glow. 1200×630 (large card).

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 800; style: "normal" };

// Fetched once per server instance. Without a browser user agent Google Fonts serves TTF,
// which is what ImageResponse needs. If it fails the image still renders in the built-in font.
let fontsPromise: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  fontsPromise ??= (async () => {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Geist:wght@400;600;800")).text();
    const urls = [...css.matchAll(/src: url\((.+?)\) format\('truetype'\)/g)].map((m) => m[1]);
    if (urls.length < 3) throw new Error("font urls not found");
    const [regular, semi, bold] = await Promise.all(urls.slice(0, 3).map(async (u) => (await fetch(u)).arrayBuffer()));
    return [
      { name: "Geist", data: regular, weight: 400, style: "normal" },
      { name: "Geist", data: semi, weight: 600, style: "normal" },
      { name: "Geist", data: bold, weight: 800, style: "normal" },
    ] satisfies Font[];
  })().catch((err) => {
    console.error("og font load failed", err);
    fontsPromise = null;
    return [];
  });
  return fontsPromise;
}

let logoPromise: Promise<string | null> | null = null;
const loadLogo = () =>
  (logoPromise ??= readFile(path.join(process.cwd(), "public", "logo.png"))
    .then((b) => `data:image/png;base64,${b.toString("base64")}`)
    .catch(() => null));

// Satori can't draw radial gradients reliably, so the grid, glow and fade are one SVG layer.
const background = (accent: string) =>
  `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs>
<pattern id="g" width="62" height="62" patternUnits="userSpaceOnUse"><path d="M62 0H0V62" fill="none" stroke="#8a7440" stroke-opacity="0.2" stroke-width="1.5"/></pattern>
<radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="0" cy="630" r="950"><stop offset="0.35" stop-color="#fff"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="1150" cy="0" r="760"><stop offset="0" stop-color="${accent}" stop-opacity="0.5"/><stop offset="0.45" stop-color="${accent}" stop-opacity="0.2"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="630" fill="#fff"/><rect width="1200" height="630" fill="url(#g)"/><rect width="1200" height="630" fill="url(#fade)"/><rect width="1200" height="630" fill="url(#glow)"/>
</svg>`).toString("base64")}`;

export async function GET(request: NextRequest) {
  await connection();
  const id = request.nextUrl.searchParams.get("page");
  const page = PAGES[isPageId(id) ? id : "home"];
  const [seo, fonts, logo] = await Promise.all([getSeo(), loadFonts(), loadLogo()]);
  const accent = seo.color;
  const ink = "#16181d";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#ffffff", fontFamily: "Geist" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
        <img src={background(accent)} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "80px 80px 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
            {logo && <img src={logo} width={52} height={52} alt="" style={{ borderRadius: 9999 }} />}
            <span style={{ fontSize: 34, fontWeight: 600, color: ink }}>{seo.siteName || seo.title}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontSize: 104, fontWeight: 800, color: accent, letterSpacing: -3, lineHeight: 1 }}>{page.title}</span>
            <span style={{ fontSize: 36, fontWeight: 400, color: ink, lineHeight: 1.3, maxWidth: 1000 }}>{page.description}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    },
  );
}
