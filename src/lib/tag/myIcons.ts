"use client";

import { createLocalList } from "../localList";
import { ICON_SIZE, type Icon } from "./icons";

const isIcon = (v: unknown): v is Icon => {
  const i = v as Icon;
  return (
    typeof i?.id === "string" &&
    typeof i.name === "string" &&
    Array.isArray(i.pixels) &&
    i.pixels.length === ICON_SIZE &&
    i.pixels.every((r) => Array.isArray(r) && r.length === ICON_SIZE && r.every((p) => typeof p === "boolean"))
  );
};

const store = createLocalList("rankgen.icons.v2", isIcon);
export const saveMyIcons = store.save;
export const useMyIcons = store.useList;
