// Frames traced pixel-for-pixel from the designs in "template style/".
// Shade keys are the exact design colors, drawn at the reference base color (BASE_RGB).
// Other base colors scale every shade by the same per-channel ratio. "." is transparent.
// Each frame: left cap rows (padding included), 1px middle column (repeated), right cap (mirrors left if omitted).
export const FRAME_HEIGHT = 12;

export type RGB = [number, number, number];

export const BASE_RGB: RGB = [178, 136, 26];
export const BASE_HEX = "#b2881a";

export const PALETTE: Record<string, RGB> = {
  t: [146, 111, 21], // top outline
  h: [189, 144, 27], // highlight
  b: BASE_RGB, // base (upper half)
  s: [154, 117, 22], // shade (lower half)
  d: [136, 103, 19], // detail
  o: [126, 96, 18], // bottom outline
  m: [125, 95, 18], // dark rim
  k: [112, 85, 16], // dark outline
};

export interface Frame {
  id: string;
  name: string;
  left: string[];
  mid: string;
  right?: string[];
}

export const FRAMES: Frame[] = [
  {
    id: "classic",
    name: "Classic",
    mid: "thbbbbssssho",
    left: [".ttttttt", "tthhhhhh", "thbbbbbb", "thbbbbbb", "thbbbbbb", "thbbbbbb", "ohssssss", "ohssssss", "ohssssss", "ohssssss", "oohhhhhh", ".ooooooo"],
  },
  {
    id: "cartoon",
    name: "Cartoon",
    mid: "thbbbbssssmk",
    left: [".ttttttt", "tthhhhhh", "thbbbbbb", "tbbdbbbb", "tbbbdbbb", "tbbbbbbb", "ksssssss", "ksssdsss", "kssdssss", "kmssssss", "kkmmmmmm", ".kkkkkkk"],
  },
  {
    id: "extrarounded",
    name: "Extra Rounded",
    mid: "thbbbbssssho",
    left: ["..tttttt", ".tthhhhh", ".thbbbbb", "tthbdbdb", "thbddbbb", "thbbbbbb", "ohssssss", "ohsddsss", "oohsdsds", ".ohsssss", ".oohhhhh", "..oooooo"],
  },
  {
    id: "hourglass",
    name: "Hourglass",
    mid: "thbbbbssssho",
    left: ["..tttttt", ".thhhhhh", "thbbbbbb", "thbddbdb", "thbbdbbb", ".thbbbbb", ".ohsssss", "ohssdsss", "ohsddsds", "ohssssss", ".ohhhhhh", "..oooooo"],
  },
  {
    id: "legacy",
    name: "Legacy",
    mid: "tbbbbbssssso",
    left: [".ttttttt", "ttbbbbbb", "tbbbbbbb", "tbbbbbbb", "tbbbbbbb", "tbbbbbbb", "osssssss", "osssssss", "osssssss", "osssssss", "oossssss", ".ooooooo"],
  },
  {
    id: "medieval",
    name: "Medieval",
    mid: "thbbbbssssho",
    left: ["..t..tttt", ".thttthhh", ".thhhhbbb", ".thbbbbdb", "tthbdbddb", "tthbbbbbb", "oohssssss", "oohsdsdds", ".ohssssds", ".ohhhhsss", ".ohooohhh", "..o..oooo"],
  },
  {
    id: "modern",
    name: "Modern",
    mid: "thbbbbssshmk",
    left: ["..tttttt", "tthhhhhh", "thbbbbbb", "thbbbbbb", "thbbbbbb", "thbbbbbb", "khssssss", "khssssss", "khssssss", "kmhhhhhh", "kkmmmmmm", ".kkkkkkk"],
  },
  {
    id: "roundedcorners",
    name: "Rounded Corners",
    mid: "thbbbbssssho",
    left: [".ttttttt", "tthhhhhh", "thhbbbbb", "thbbdbdb", "thbddbbb", "thbbbbbb", "ohssssss", "ohsddsss", "ohssdsds", "ohhsssss", "oohhhhhh", ".ooooooo"],
  },
  {
    id: "squared",
    name: "Squared",
    mid: "thbbbbssssho",
    left: ["tttttttt", "thhhhhhh", "thbbbbbb", "thbddbdb", "thbddbbb", "thbbbbbb", "ohssssss", "ohsddsss", "ohsddsds", "ohssssss", "ohhhhhhh", "oooooooo"],
  },
  {
    id: "tapered",
    name: "Tapered",
    mid: "thbbbbssssho",
    left: ["....tttt", "...thhhh", "..thbbbb", ".thbbbbb", ".thbbbbb", "thbbbbbb", "ohssssss", "ohssssss", "ohssssss", "ohssssss", "oohhhhhh", ".ooooooo"],
  },
];

// Icon box for a frame: its caps trimmed down to the outer border (inner detail columns dropped).
export function iconFrame(frame: Frame): Frame {
  const fits = (rows: string[], x: number) => rows.every((row, y) => row[x] === frame.mid[y] || row[x] === "d");
  const trim = (rows: string[], fromEnd: boolean) => {
    const cols = rows[0].length;
    for (let n = 1; n < cols; n++) if (fits(rows, fromEnd ? cols - 1 - n : n)) return rows.map((r) => (fromEnd ? r.slice(cols - n) : r.slice(0, n)));
    return rows;
  };
  return { ...frame, left: trim(frame.left, false), right: frame.right && trim(frame.right, true) };
}
