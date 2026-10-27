"use client";

import { useRef, useState } from "react";
import { Eraser, Pencil, Redo2, Trash2, Undo2, X } from "lucide-react";
import { ICON_SIZE, PRESET_ICONS, emptyGrid, type Icon, type PixelGrid } from "@/lib/tag/icons";
import { renderIconBox, type BoxStyle } from "@/lib/tag/render";
import { TagCanvas } from "./TagCanvas";
import { IconButton, Segmented } from "./ui";

const clone = (g: PixelGrid) => g.map((r) => [...r]);
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

type Tab = "draw" | "presets" | "mine";

export function IconEditor({
  initial,
  myIcons,
  style,
  onSave,
  onDelete,
  onClose,
}: {
  initial: PixelGrid | null;
  myIcons: Icon[];
  style: BoxStyle;
  onSave: (icon: Icon) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("draw");
  const [grid, setGrid] = useState<PixelGrid>(() => clone(initial ?? emptyGrid()));
  const [undo, setUndo] = useState<PixelGrid[]>([]);
  const [redo, setRedo] = useState<PixelGrid[]>([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [name, setName] = useState("");
  const painting = useRef(false);

  const commit = (next: PixelGrid) => {
    setUndo([...undo, grid]);
    setRedo([]);
    setGrid(next);
  };

  const paint = (x: number, y: number) =>
    setGrid((g) => {
      const v = tool === "pen";
      if (g[y][x] === v) return g;
      const n = clone(g);
      n[y][x] = v;
      return n;
    });

  const cellAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * ICON_SIZE);
    const y = Math.floor(((e.clientY - r.top) / r.height) * ICON_SIZE);
    return x >= 0 && y >= 0 && x < ICON_SIZE && y < ICON_SIZE ? ([x, y] as const) : null;
  };

  const step = (from: PixelGrid[], to: PixelGrid[], setFrom: typeof setUndo, setTo: typeof setRedo) => {
    const prev = from.at(-1);
    if (!prev) return;
    setFrom(from.slice(0, -1));
    setTo([...to, grid]);
    setGrid(prev);
  };

  const isEmpty = grid.every((r) => r.every((c) => !c));
  const library = tab === "presets" ? PRESET_ICONS : myIcons;

  return (
    <>
      <Segmented
        label="Icon source"
        value={tab}
        onChange={setTab}
        options={[
          { value: "draw", label: "Draw" },
          { value: "presets", label: "Presets" },
          { value: "mine", label: `My icons (${myIcons.length})` },
        ]}
      />

      {tab === "draw" ? (
        <>
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-10">
            <div
              className="stage grid aspect-square w-[min(100%,24rem,34dvh)] cursor-crosshair touch-none select-none overflow-hidden rounded-xl border border-line"
              style={{ gridTemplateColumns: `repeat(${ICON_SIZE}, 1fr)` }}
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
                row.map((on, x) => <div key={`${x}-${y}`} className={`border border-white/5 ${on ? "bg-ink" : ""}`} />),
              )}
            </div>
            <div className="flex flex-col items-center gap-2 text-xs text-muted">
              <TagCanvas bitmap={renderIconBox({ pixels: grid }, style)} scale={8} />
              Preview
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex gap-1 rounded-xl border border-line bg-raised p-1">
              <IconButton label="Pen" icon={Pencil} active={tool === "pen"} onClick={() => setTool("pen")} />
              <IconButton label="Eraser" icon={Eraser} active={tool === "eraser"} onClick={() => setTool("eraser")} />
            </div>
            <div className="flex gap-1">
              <IconButton label="Undo" icon={Undo2} disabled={!undo.length} onClick={() => step(undo, redo, setUndo, setRedo)} />
              <IconButton label="Redo" icon={Redo2} disabled={!redo.length} onClick={() => step(redo, undo, setRedo, setUndo)} />
              <IconButton label="Clear" icon={Trash2} disabled={isEmpty} onClick={() => commit(emptyGrid())} />
            </div>
          </div>
          <p className="text-center text-xs text-muted">Icons are drawn in white with a shadow, in the icon box style from the Prefix icon section.</p>
        </>
      ) : (
        <div className="scroll-area grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {library.map((i) => (
            <div key={i.id} className="relative">
              <button
                type="button"
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-line p-3 text-xs transition-colors hover:border-gold"
                onClick={() => {
                  commit(clone(i.pixels));
                  setTab("draw");
                }}
                title={`Edit ${i.name}`}
              >
                <TagCanvas bitmap={renderIconBox(i, style)} scale={4} />
                <span className="max-w-full truncate">{i.name}</span>
              </button>
              {tab === "mine" && (
                <button
                  type="button"
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-md text-muted hover:text-red-400"
                  onClick={() => onDelete(i.id)}
                  aria-label={`Delete ${i.name}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          ))}
          {!library.length && <p className="col-span-full text-sm text-muted">No saved icons yet. Draw one and press Save and use.</p>}
        </div>
      )}

      <input className="input" aria-label="Icon name" placeholder="Icon name (optional)" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-gold"
          disabled={isEmpty}
          onClick={() => onSave({ id: newId(), name: name.trim() || "Custom icon", pixels: grid })}
        >
          Save and use
        </button>
      </div>
    </>
  );
}
