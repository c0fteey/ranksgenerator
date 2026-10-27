// Icons are 5x5 masks drawn in white with the text shadow. Traced presets also keep their exact
// art: the 5x6 icon area (shadow row included) as w white, c cream, x shadow, . box.
export const ICON_SIZE = 5;

export type PixelGrid = boolean[][];

export interface Icon {
  id: string;
  name: string;
  pixels: PixelGrid;
  art?: string[];
}

const fromArt = (art: string[]): PixelGrid => art.slice(0, ICON_SIZE).map((r) => [...r].map((ch) => ch === "w" || ch === "c"));

export const emptyGrid = (): PixelGrid =>
  Array.from({ length: ICON_SIZE }, () => Array<boolean>(ICON_SIZE).fill(false));

// Traced from the designs in "template style/Yeni klasör/".
const PRESETS: [string, string, string[]][] = [
  ["bubble", "Bubble", [".www.", "wwwww", "wwwww", "xwwwx", "cxxx.", "x...."]],
  ["chestplate", "Chestplate", ["w...w", "ww.ww", "ww.ww", "cc.cc", "xc.cx", ".x.x."]],
  ["circle", "Circle", [".www.", "wwwww", "wwwww", "ccccc", "xcccx", ".xxx."]],
  ["compass", "Compass", ["..w..", ".www.", "wwxww", "xcccx", ".xcx.", "..x.."]],
  ["computer", "Computer", ["wwwww", "wxxxw", "wwwww", "xxwxx", "ccccc", "xxxxx"]],
  ["crate", "Crate", ["wwwww", "wwxww", "xxwxx", "ccxcc", "ccccc", "xxxxx"]],
  ["crate2", "Crate 2", ["w.w.w", "wwwww", "xxwxx", "ccxcc", "ccccc", "xxxxx"]],
  ["crates3", "Crates 3", ["wwwww", "xxxxx", "ww.ww", "ccccc", "ccccc", "xxxxx"]],
  ["crown", "Crown", ["..w..", "w.w.w", "wwwww", "xxxxx", "ccccc", "xxxxx"]],
  ["crown2", "Crown 2", [".....", "w.w.w", "wwwww", "xxxxx", "ccccc", "xxxxx"]],
  ["crystal", "Crystal", ["..w..", ".www.", "wwwww", "xwwwx", ".xcx.", "..x.."]],
  ["cup", "Cup", [".....", ".....", "wwwww", "wwwww", "xcccx", ".xxx."]],
  ["gear", "Gear", ["w.w.w", "xwwwx", "wwxww", "xcccx", "cxcxc", "x.x.x"]],
  ["hammer", "Hammer", [".ww..", ".www.", ".xwww", ".wxww", "cx.xx", "x...."]],
  ["heart", "Heart", [".w.w.", "wwwww", "wwwww", "xcccx", ".xcx.", "..x.."]],
  ["icon", "Icon", [".....", ".....", ".....", "..c..", "..x..", "....."]],
  ["informationmark", "Information", [".www.", ".xxx.", ".www.", ".www.", ".ccc.", ".xxx."]],
  ["playbutton", "Play", ["www..", "wwww.", "wwwww", "wwwwx", "cccx.", "xxx.."]],
  ["questionmark", "Question", [".www.", "wxxxw", "x..wx", "...x.", "..c..", "..x.."]],
  ["shield", "Shield", [".www.", "wwwww", "wwwww", "xwwwx", ".xcx.", "..x.."]],
  ["shield2", "Shield 2", ["wwwww", "wwwww", "wxxxw", "w...w", "xcccx", ".xxx."]],
  ["shield3", "Shield 3", ["wwwww", "xxxxx", "wwwww", "wwwww", "xcccx", ".xxx."]],
  ["skull", "Skull", [".www.", "wxwxw", "wwxww", "xcccx", ".cxc.", ".x.x."]],
  ["squires", "Squires", ["ww.ww", "ww.ww", "xx.xx", "ww.ww", "cc.cc", "xx.xx"]],
  ["star", "Star", [".www.", "wwwww", "xwwwx", "wwxww", "cc.cc", "xx.xx"]],
  ["star2", "Star 2", [".www.", "wwwww", "xwwwx", ".cxc.", ".c.c.", ".x.x."]],
  ["user", "User", [".www.", ".www.", ".xxx.", "wwwww", "ccccc", "xxxxx"]],
];

export const PRESET_ICONS: Icon[] = PRESETS.map(([id, name, art]) => ({ id, name, pixels: fromArt(art), art }));
