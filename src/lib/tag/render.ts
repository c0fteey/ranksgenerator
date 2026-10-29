import { BASE_RGB, FRAME_HEIGHT, PALETTE, iconFrame, type Frame, type RGB } from "./frames";
import { GLYPH_HEIGHT, glyph, textWidth } from "./font";
import { type Icon } from "./icons";

export interface Bitmap {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface BoxStyle {
  frame: Frame;
  colors: string[]; // 1 = solid, 2 = horizontal gradient
}

export interface RankOptions extends BoxStyle {
  text: string;
  textColor: string;
  shadow: boolean;
  icon: IconArt | null;
  iconStyle: BoxStyle;
}

export type IconArt = Pick<Icon, "pixels" | "art">;

const BOX_GAP = 2;
const TEXT_Y = 3;
const MIN_CONTENT = 4;
// Text rows below this frame row use the lower tint, as in the designs.
const TEXT_LOWER_Y = 6;
const TEXT_LOWER_TINT: RGB = [239 / 255, 234 / 255, 221 / 255];
const SHADOW = 0.45;
const ICON_COLOR = "#ffffff";

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const mul = (c: RGB, f: RGB): RGB => [Math.round(c[0] * f[0]), Math.round(c[1] * f[1]), Math.round(c[2] * f[2])];

// Shade color re-based from the design's base color onto `base`.
const tint = (shade: RGB, base: RGB): RGB => mul(shade, [base[0] / BASE_RGB[0], base[1] / BASE_RGB[1], base[2] / BASE_RGB[2]]);

export const frameShade = (key: string, base: string): RGB => tint(PALETTE[key], hexToRgb(base));

// Content area starts at TEXT_Y and is GLYPH_HEIGHT + 1 rows tall (the last row holds the shadow).
// Each pixel is w (color), c (color, lower tint), x (shadow over the frame) or anything else for none.
type Shade = (x: number, y: number) => string | undefined;

const maskShade = (on: (x: number, y: number) => boolean, shadow: boolean): Shade => (x, y) =>
  on(x, y) ? (TEXT_Y + y < TEXT_LOWER_Y ? "w" : "c") : shadow && y > 0 && on(x, y - 1) ? "x" : undefined;

function renderBox(frame: Frame, colors: string[], content: { width: number; shade: Shade; color: string }): Bitmap {
  const right = frame.right ?? frame.left.map((row) => [...row].reverse().join(""));
  const L = frame.left[0].length;
  const R = right[0].length;
  const W = L + Math.max(MIN_CONTENT, content.width) + R;
  const H = FRAME_HEIGHT;
  const data = new Uint8ClampedArray(W * H * 4);

  const get = (x: number, y: number): RGB => {
    const i = (y * W + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const set = (x: number, y: number, c: RGB) => {
    const i = (y * W + x) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };

  const [c1, c2 = c1] = colors.map(hexToRgb);
  for (let x = 0; x < W; x++) {
    const base = mix(c1, c2, W > 1 ? x / (W - 1) : 0);
    for (let y = 0; y < H; y++) {
      const ch = x < L ? frame.left[y][x] : x >= W - R ? right[y][x - (W - R)] : frame.mid[y];
      if (ch !== ".") set(x, y, tint(PALETTE[ch], base));
    }
  }

  const x0 = L + ((Math.max(MIN_CONTENT, content.width) - content.width) >> 1);
  const top = hexToRgb(content.color);
  const lower = mul(top, TEXT_LOWER_TINT);
  for (let y = 0; y <= GLYPH_HEIGHT; y++)
    for (let x = 0; x < content.width; x++) {
      const px = x0 + x;
      const py = TEXT_Y + y;
      const ch = content.shade(x, y);
      if (ch === "w") set(px, py, top);
      else if (ch === "c") set(px, py, lower);
      else if (ch === "x") set(px, py, mul(get(px, py), [SHADOW, SHADOW, SHADOW]));
    }
  return { width: W, height: H, data };
}

export function renderTagBox(o: Pick<RankOptions, "text" | "textColor" | "shadow"> & BoxStyle): Bitmap {
  const rows = Array.from({ length: GLYPH_HEIGHT }, (_, y) => [...o.text].map((ch) => glyph(ch)[y]).join("."));
  return renderBox(o.frame, o.colors, {
    width: textWidth(o.text),
    shade: maskShade((x, y) => y < GLYPH_HEIGHT && rows[y][x] === "#", o.shadow),
    color: o.textColor,
  });
}

// The icon itself never changes (traced presets keep their exact art); only its box follows the style.
export function renderIconBox({ pixels, art }: IconArt, { frame, colors }: BoxStyle): Bitmap {
  return renderBox(iconFrame(frame), colors, {
    width: pixels[0].length,
    shade: art ? (x, y) => art[y][x] : maskShade((x, y) => y < pixels.length && pixels[y][x], true),
    color: ICON_COLOR,
  });
}

function hconcat(a: Bitmap, b: Bitmap, gap: number): Bitmap {
  const width = a.width + gap + b.width;
  const height = Math.max(a.height, b.height);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    data.set(a.data.subarray(y * a.width * 4, (y + 1) * a.width * 4), y * width * 4);
    data.set(b.data.subarray(y * b.width * 4, (y + 1) * b.width * 4), (y * width + a.width + gap) * 4);
  }
  return { width, height, data };
}

// Pixel drop shadow one pixel down and right; opacity is 0–1. Grows the bitmap by one row and column.
export function withDropShadow(src: Bitmap, opacity: number): Bitmap {
  const width = src.width + 1;
  const height = src.height + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) if (src.data[(y * src.width + x) * 4 + 3]) data[((y + 1) * width + x + 1) * 4 + 3] = alpha;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (src.data[i + 3]) data.set(src.data.subarray(i, i + 4), (y * width + x) * 4);
    }
  return { width, height, data };
}

export function renderRank(o: RankOptions): Bitmap {
  const tag = renderTagBox(o);
  return o.icon ? hconcat(renderIconBox(o.icon, o.iconStyle), tag, BOX_GAP) : tag;
}
