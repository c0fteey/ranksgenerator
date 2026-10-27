"use client";

import { useRef, useState } from "react";
import { Eraser, Minus, Plus, Redo2, Trash2, Undo2, X } from "lucide-react";
import { FRAMES, FRAME_HEIGHT, type Frame } from "@/lib/tag/frames";
import { frameShade, renderTagBox } from "@/lib/tag/render";
import { newId } from "./IconEditor";
import { TagCanvas } from "./TagCanvas";
import { IconButton, Segmented } from "./ui";

// Draft grid: one row per frame row, left edge columns followed by the repeated middle column.
type Grid = string[][];

const SHADES = [
  ["t", "Top outline"],
  ["h", "Highlight"],
  ["b", "Base"],
  ["s", "Shade"],
  ["d", "Detail"],
  ["o", "Bottom outline"],
  ["m", "Dark rim"],
  ["k", "Dark outline"],
] as const;
const MAX_EDGE = 12;
// Grid cell size follows the viewport so the 12-row grid always fits on screen.
const CELL = "clamp(14px, min(2.4vw, 2.8dvh), 32px)";

const toGrid = (f: Frame): Grid => f.left.map((row, y) => [...row, f.mid[y]]);
const toFrame = (g: Grid, id: string, name: string): Frame => ({
  id,
  name,
  left: g.map((r) => r.slice(0, -1).join("")),
  mid: g.map((r) => r.at(-1)).join(""),
});
const clone = (g: Grid) => g.map((r) => [...r]);

type Tab = "draw" | "presets" | "mine";

export function TemplateEditor({
  initial,
  myFrames,
  colors,
  text,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Frame;
  myFrames: Frame[];
  colors: string[];
  text: string;
  onSave: (frame: Frame) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("draw");
  const [grid, setGrid] = useState<Grid>(() => toGrid(initial));
  const [undo, setUndo] = useState<Grid[]>([]);
  const [redo, setRedo] = useState<Grid[]>([]);
  const [tool, setTool] = useState<string>("b");
  const [name, setName] = useState("");
  const painting = useRef(false);

  const cols = grid[0].length;
  const edge = cols - 1;
  const base = colors[0];
  const draft = toFrame(grid, "draft", "Draft");
  const preview = (frame: Frame) => renderTagBox({ text: text || "ADMIN", textColor: "#ffffff", shadow: true, frame, colors });
  const cellColor = (ch: string) => (ch === "." ? undefined : `rgb(${frameShade(ch, base).join(" ")})`);

  const commit = (next: Grid) => {
    setUndo([...undo, grid]);
    setRedo([]);
    setGrid(next);
  };

  const paint = (x: number, y: number) =>
    setGrid((g) => {
      if (g[y][x] === tool) return g;
      const n = clone(g);
      n[y][x] = tool;
      return n;
    });

  const cellAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * cols);
    const y = Math.floor(((e.clientY - r.top) / r.height) * FRAME_HEIGHT);
    return x >= 0 && y >= 0 && x < cols && y < FRAME_HEIGHT ? ([x, y] as const) : null;
  };

  const step = (from: Grid[], to: Grid[], setFrom: typeof setUndo, setTo: typeof setRedo) => {
    const prev = from.at(-1);
    if (!prev) return;
    setFrom(from.slice(0, -1));
    setTo([...to, grid]);
    setGrid(prev);
  };

  // New edge columns copy the middle column; removing drops the innermost edge column.
  const resize = (delta: number) =>
    commit(grid.map((r) => (delta > 0 ? [...r.slice(0, -1), r.at(-1)!, r.at(-1)!] : [...r.slice(0, -2), r.at(-1)!])));

  const isEmpty = grid.every((r) => r.every((c) => c === "."));
  const library = tab === "presets" ? FRAMES : myFrames;

  return (
    <>
      <Segmented
        label="Template source"
        value={tab}
        onChange={setTab}
        options={[
          { value: "draw", label: "Draw" },
          { value: "presets", label: "Templates" },
          { value: "mine", label: `My templates (${myFrames.length})` },
        ]}
      />

      {tab === "draw" ? (
        <>
          <div className="flex flex-col items-center gap-4 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div
              className="stage grid cursor-crosshair touch-none select-none overflow-hidden rounded-xl border border-line"
              style={{ gridTemplateColumns: `repeat(${cols}, ${CELL})`, gridAutoRows: CELL }}
              onPointerDown={(e) => {
                const cell = cellAt(e);
                if (!cell) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setUndo([...undo, grid]);
                setRedo([]);
                painting.current = true;
                paint(...cell);
              }}
              onPointerMove={(e) => {
                const cell = painting.current && cellAt(e);
                if (cell) paint(...cell);
              }}
              onPointerUp={() => (painting.current = false)}
            >
              {grid.flatMap((row, y) =>
                row.map((ch, x) => (
                  <div
                    key={`${x}-${y}`}
                    className={`border border-white/5 ${x === edge ? "border-l-2 border-l-gold/60" : ""}`}
                    style={{ backgroundColor: cellColor(ch) }}
                  />
                )),
              )}
            </div>
            <div className="flex w-full flex-col gap-4">
              <div className="stage flex min-h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-line p-4">
                <TagCanvas bitmap={preview(draft)} scale={5} />
              </div>
              <p className="text-center text-xs text-muted lg:text-left">
                Left edge of the tag; the right edge mirrors it. The last column (gold line) repeats under the text.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {SHADES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={tool === key}
                onClick={() => setTool(key)}
                className={`size-8 rounded-lg border border-white/15 ring-2 ring-offset-2 ring-offset-surface transition ${tool === key ? "ring-gold" : "ring-transparent hover:ring-line"}`}
                style={{ backgroundColor: cellColor(key) }}
              />
            ))}
            <IconButton label="Eraser" icon={Eraser} active={tool === "."} onClick={() => setTool(".")} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-raised p-1 text-xs text-muted">
              <IconButton label="Narrower edge" icon={Minus} disabled={edge <= 1} onClick={() => resize(-1)} />
              <span className="px-1">Edge {edge}px</span>
              <IconButton label="Wider edge" icon={Plus} disabled={edge >= MAX_EDGE} onClick={() => resize(1)} />
            </div>
            <div className="flex gap-1">
              <IconButton label="Undo" icon={Undo2} disabled={!undo.length} onClick={() => step(undo, redo, setUndo, setRedo)} />
              <IconButton label="Redo" icon={Redo2} disabled={!redo.length} onClick={() => step(redo, undo, setRedo, setUndo)} />
              <IconButton label="Clear" icon={Trash2} disabled={isEmpty} onClick={() => commit(grid.map((r) => r.map(() => ".")))} />
            </div>
          </div>
        </>
      ) : (
        <div className="scroll-area grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {library.map((f) => (
            <div key={f.id} className="relative">
              <button
                type="button"
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-line p-3 text-xs transition-colors hover:border-gold"
                onClick={() => {
                  commit(toGrid(f));
                  setTab("draw");
                }}
                title={`Edit ${f.name}`}
              >
                <TagCanvas bitmap={preview(f)} scale={3} />
                <span className="max-w-full truncate">{f.name}</span>
              </button>
              {tab === "mine" && (
                <button
                  type="button"
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-md text-muted hover:text-red-400"
                  onClick={() => onDelete(f.id)}
                  aria-label={`Delete ${f.name}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          ))}
          {!library.length && <p className="col-span-full text-sm text-muted">No saved templates yet. Draw one and press Save and use.</p>}
        </div>
      )}

      <input className="input" aria-label="Template name" placeholder="Template name (optional)" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-gold" disabled={isEmpty} onClick={() => onSave(toFrame(grid, newId(), name.trim() || "Custom template"))}>
          Save and use
        </button>
      </div>
    </>
  );
}
