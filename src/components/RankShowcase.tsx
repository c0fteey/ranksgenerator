"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { FRAMES } from "@/lib/tag/frames";
import { PRESET_ICONS } from "@/lib/tag/icons";
import { renderRank, type Bitmap } from "@/lib/tag/render";

// Decorative example ranks floating beside the login card. A new random set on every page load.
// They are view-only: drawn into canvases (no image URL to save or find in the network tab),
// unclickable, and the canvases are tainted so toDataURL/getImageData throw from the console.
// Screenshots can't be prevented by any page.

const TEXTS = ["KURUCU", "OWNER", "REHBER", "T. REHBER", "YETKILI", "MODERATOR", "ADMIN", "BUILDER", "DESTEK", "HELPER", "VIP", "MVP+", "YOUTUBER", "EKIP"];
const COUNT = 5;
const SCALE = 4;
// Around the card (max-w-md = 28rem, so 14rem each side of center, plus a gap).
const SLOTS = [
  { side: "left", top: 14 },
  { side: "left", top: 46 },
  { side: "left", top: 76 },
  { side: "right", top: 18 },
  { side: "right", top: 50 },
  { side: "right", top: 80 },
] as const;

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const shuffle = <T,>(list: readonly T[]) => [...list].sort(() => Math.random() - 0.5);

function randomColor() {
  const h = Math.random() * 360;
  const s = 0.55 + Math.random() * 0.35;
  const l = 0.42 + Math.random() * 0.16;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface Example {
  bitmap: Bitmap;
  side: "left" | "right";
  top: number;
  offset: number;
  rotate: number;
  delay: number;
}

function makeExamples(): Example[] {
  const texts = shuffle(TEXTS);
  return shuffle(SLOTS)
    .slice(0, COUNT)
    .map((slot, i) => {
      const frame = pick(FRAMES);
      const colors = Math.random() < 0.4 ? [randomColor(), randomColor()] : [randomColor()];
      const icon = Math.random() < 0.6 ? pick(PRESET_ICONS) : null;
      return {
        bitmap: renderRank({ text: texts[i], textColor: "#ffffff", shadow: true, frame, colors, icon, iconStyle: { frame, colors } }),
        side: slot.side,
        top: slot.top + (Math.random() * 6 - 3),
        offset: Math.round(Math.random() * 60),
        rotate: Math.round((Math.random() * 10 - 5) * 10) / 10,
        delay: Math.round(Math.random() * 3000),
      };
    });
}

// Made once per page load on the client; the server renders nothing, so there's no hydration mismatch.
let examples: Example[] | null = null;
const getExamples = () => (examples ??= makeExamples());
const subscribe = () => () => {};

// Any cross-origin image drawn without CORS taints a canvas, which blocks reading its pixels.
let taint: Promise<HTMLImageElement | null> | null = null;
const loadTaint = () =>
  (taint ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "https://cdn.discordapp.com/embed/avatars/0.png";
  }));

export function RankShowcase() {
  const list = useSyncExternalStore(subscribe, getExamples, () => null);
  if (!list) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none overflow-hidden xl:block" onContextMenu={(e) => e.preventDefault()}>
      {list.map((ex, i) => (
        <div
          key={i}
          className="rank-float absolute"
          style={{
            top: `${ex.top}%`,
            [ex.side]: `calc(50% + 15rem + ${ex.offset}px)`,
            ["--tilt" as string]: `${ex.rotate}deg`,
            animationDelay: `-${ex.delay}ms`,
          }}
        >
          <ProtectedTag bitmap={ex.bitmap} />
        </div>
      ))}
    </div>
  );
}

function ProtectedTag({ bitmap }: { bitmap: Bitmap }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let cancelled = false;
    loadTaint().then((img) => {
      if (cancelled) return;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      if (img) {
        ctx.globalAlpha = 0;
        ctx.drawImage(img, 0, 0, 1, 1);
        ctx.globalAlpha = 1;
      }
      ctx.putImageData(new ImageData(bitmap.data, bitmap.width, bitmap.height), 0, 0);
      canvas.style.opacity = "";
    });
    return () => {
      cancelled = true;
    };
  }, [bitmap]);

  return (
    <canvas
      ref={ref}
      width={bitmap.width}
      height={bitmap.height}
      draggable={false}
      className="drop-shadow-[0_8px_16px_rgb(0_0_0/0.35)] transition-opacity duration-700"
      style={{ width: bitmap.width * SCALE, height: bitmap.height * SCALE, imageRendering: "pixelated", opacity: 0 }}
    />
  );
}
