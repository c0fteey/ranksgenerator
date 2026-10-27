"use client";

import { useEffect, useRef } from "react";
import type { Bitmap } from "@/lib/tag/render";

export function TagCanvas({ bitmap, scale }: { bitmap: Bitmap; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.putImageData(new ImageData(bitmap.data, bitmap.width, bitmap.height), 0, 0);
  }, [bitmap]);

  return (
    <canvas
      ref={ref}
      style={{
        width: bitmap.width * scale,
        maxWidth: "100%",
        height: "auto",
        imageRendering: "pixelated",
      }}
    />
  );
}

export function downloadPng(bitmap: Bitmap, scale: number, fileName: string) {
  const src = document.createElement("canvas");
  src.width = bitmap.width;
  src.height = bitmap.height;
  src.getContext("2d")!.putImageData(new ImageData(bitmap.data, bitmap.width, bitmap.height), 0, 0);

  const out = document.createElement("canvas");
  out.width = bitmap.width * scale;
  out.height = bitmap.height * scale;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);

  out.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}
