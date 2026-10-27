"use client";

import { createLocalList } from "../localList";
import { FRAME_HEIGHT, PALETTE, type Frame } from "./frames";

const isRow = (r: unknown, width: number) => typeof r === "string" && r.length === width && [...r].every((ch) => ch === "." || ch in PALETTE);

const isFrame = (v: unknown): v is Frame => {
  const f = v as Frame;
  return (
    typeof f?.id === "string" &&
    typeof f.name === "string" &&
    isRow(f.mid, FRAME_HEIGHT) &&
    Array.isArray(f.left) &&
    f.left.length === FRAME_HEIGHT &&
    f.left[0]?.length > 0 &&
    f.left.every((r) => isRow(r, f.left[0].length)) &&
    f.right === undefined
  );
};

const store = createLocalList("rankgen.frames.v1", isFrame);
export const saveMyFrames = store.save;
export const useMyFrames = store.useList;
