"use client";

import { BASE_HEX, FRAMES } from "@/lib/tag/frames";
import { PRESET_ICONS } from "@/lib/tag/icons";
import { renderIconBox } from "@/lib/tag/render";
import { TagCanvas } from "./TagCanvas";

const logo = renderIconBox(PRESET_ICONS.find((i) => i.id === "crown") ?? PRESET_ICONS[0], { frame: FRAMES.find((f) => f.id === "roundedcorners") ?? FRAMES[0], colors: [BASE_HEX] });

export function Logo({ scale = 2 }: { scale?: number }) {
  return <TagCanvas bitmap={logo} scale={scale} />;
}
