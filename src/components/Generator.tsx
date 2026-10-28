"use client";

import { useState } from "react";
import { Download, Maximize2, Palette, Pencil, Sparkles, Type } from "lucide-react";
import { BASE_HEX, FRAMES, type Frame } from "@/lib/tag/frames";
import { PRESET_ICONS } from "@/lib/tag/icons";
import { MAX_LENGTH, sanitizeText } from "@/lib/tag/font";
import { renderIconBox, renderRank, renderTagBox, type BoxStyle } from "@/lib/tag/render";
import { saveMyIcons, useMyIcons } from "@/lib/tag/myIcons";
import { saveMyFrames, useMyFrames } from "@/lib/tag/myFrames";
import { useUndoable } from "@/lib/useUndoable";
import { TagCanvas, downloadPng } from "./TagCanvas";
import { IconEditor } from "./IconEditor";
import { TemplateEditor } from "./TemplateEditor";
import { Editor, type EditorPage } from "./Editor";
import { ColorField, Field, Section, Segmented, Select, SelectGroup, SelectItem, SwitchCard } from "./ui";

const TAG_PRESETS = ["#e9e4a6", "#a8d8a0", "#f5cdb0", "#e03c3c", "#5b6ea8"];
// The templates and icons are drawn in white with a shadow.
const TEXT_COLOR = "#ffffff";
const SCALES = [1, 2, 4, 8, 16];
// Radix Select items cannot use an empty value.
const NO_ICON = "none";
const PREVIEW_SCALES = [1, 2, 3, 4].map((s) => ({ value: String(s), label: `${s}x` }));
// Preview backdrops only; the exported PNG stays transparent.
const BACKDROPS = {
  transparent: { label: "Transparent", className: "stage", style: {} },
  minecraft: {
    label: "Minecraft chat",
    className: "",
    style: { background: "linear-gradient(rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.5)), linear-gradient(#7fb0ff 55%, #5f9e3c 55%)" },
  },
  light: { label: "Light", className: "", style: { background: "#f4f3f0" } },
  dark: { label: "Dark", className: "", style: { background: "#1b1a18" } },
};
type Backdrop = keyof typeof BACKDROPS;
const BACKDROP_OPTIONS = Object.entries(BACKDROPS).map(([value, b]) => ({ value: value as Backdrop, label: b.label }));
const MODES = [
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
] as { value: Mode; label: string }[];

type Mode = "solid" | "gradient";
interface Tint {
  mode: Mode;
  c1: string;
  c2: string;
}

const tintColors = (t: Tint) => (t.mode === "gradient" ? [t.c1, t.c2] : [t.c1]);

export default function Generator() {
  const basics = useUndoable({ text: "ADMIN", frameId: FRAMES[0].id });
  const colors = useUndoable({ mode: "solid" as Mode, c1: BASE_HEX, c2: TAG_PRESETS[3] });
  // Separate icon box style by default: Rounded Corners is the box the icons were drawn in.
  const iconCfg = useUndoable({
    iconId: "",
    syncFrame: false,
    frameId: "roundedcorners",
    syncColors: true,
    mode: "solid" as Mode,
    c1: BASE_HEX,
    c2: TAG_PRESETS[3],
  });
  const [trueSize, setTrueSize] = useState(false);
  const [trueScale, setTrueScale] = useState(2);
  const [backdrop, setBackdrop] = useState<Backdrop>("dark");
  const [scale, setScale] = useState(8);
  const [editor, setEditor] = useState<EditorPage | null>(null);
  const myIcons = useMyIcons();
  const myFrames = useMyFrames();
  const findFrame = (id: string) => [...FRAMES, ...myFrames].find((f) => f.id === id) ?? FRAMES[0];

  const b = basics.value;
  const c = colors.value;
  const ic = iconCfg.value;
  const tagColors = tintColors(c);
  const icon = [...PRESET_ICONS, ...myIcons].find((i) => i.id === ic.iconId) ?? null;
  const iconStyle: BoxStyle = {
    frame: findFrame(ic.syncFrame ? b.frameId : ic.frameId),
    colors: ic.syncColors ? tagColors : tintColors(ic),
  };

  const bitmap = renderRank({ text: b.text, frame: findFrame(b.frameId), colors: tagColors, textColor: TEXT_COLOR, shadow: true, icon, iconStyle });
  const previewScale = trueSize ? trueScale : Math.max(2, Math.min(12, Math.floor(720 / bitmap.width)));
  // Editor preview sits on solid black; true size uses the chosen backdrop.
  const stage = trueSize ? BACKDROPS[backdrop] : { className: "", style: { background: "#000000" } };
  const slug = b.text.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Live preview</h2>
            <p className="text-sm text-muted">Updates as you change settings.</p>
          </div>
          <button
            type="button"
            aria-pressed={trueSize}
            onClick={() => setTrueSize(!trueSize)}
            className={`${trueSize ? "btn-gold" : "btn"} shrink-0 whitespace-nowrap py-1.5 text-xs`}
          >
            <Maximize2 className="size-3.5" aria-hidden />
            {trueSize ? "Editor preview" : "True size"}
          </button>
        </header>
        <div
          className={`${stage.className} flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-line p-6`}
          style={stage.style}
        >
          <TagCanvas bitmap={bitmap} scale={previewScale} />
        </div>
        {trueSize && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Segmented label="Preview size" value={String(trueScale)} onChange={(v) => setTrueScale(Number(v))} options={PREVIEW_SCALES} />
            <Segmented label="Preview background" value={backdrop} onChange={setBackdrop} options={BACKDROP_OPTIONS} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="w-40">
            <Select label="Export size" value={String(scale)} onChange={(v) => setScale(Number(v))}>
              {SCALES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}x ({bitmap.width * s}×{bitmap.height * s})
                </SelectItem>
              ))}
            </Select>
          </div>
          <button type="button" className="btn-gold" onClick={() => downloadPng(bitmap, scale, `${slug || "rank"}-${b.frameId}.png`)}>
            <Download className="size-4" aria-hidden />
            Download PNG
          </button>
        </div>
      </section>

      <Section icon={Type} title="Tag basics" description="Text and template style for your rank tag." history={basics}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="Rank text" hint="A–Z, 0–9, _ -.+! and space">
            <div className="relative">
              <input
                aria-label="Rank text"
                className="input pr-16 uppercase"
                value={b.text}
                maxLength={MAX_LENGTH}
                placeholder="ADMIN"
                onChange={(e) => basics.set({ text: sanitizeText(e.target.value) })}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
                {b.text.length}/{MAX_LENGTH}
              </span>
            </div>
          </Field>
          <Field label="Template style">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <FrameSelect label="Template style" value={b.frameId} onChange={(frameId) => basics.set({ frameId })} myFrames={myFrames} />
              </div>
              <button type="button" className="btn shrink-0" onClick={() => setEditor("templates")}>
                <Pencil className="size-4" aria-hidden />
                Templates
              </button>
            </div>
          </Field>
        </div>
      </Section>

      <Section icon={Palette} title="Rank tag colors" description="Background tint or gradient for the main rank tag." history={colors}>
        <TintFields tint={c} onChange={colors.set} label="Background tint" />
      </Section>

      <Section icon={Sparkles} title="Prefix icon" description="Optional icon shown before the rank tag." history={iconCfg}>
        <Field label="Icon">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Select label="Icon" value={icon ? ic.iconId : NO_ICON} onChange={(iconId) => iconCfg.set({ iconId: iconId === NO_ICON ? "" : iconId })}>
                <SelectItem value={NO_ICON}>None</SelectItem>
                <SelectGroup label="Presets">
                  {PRESET_ICONS.map((i) => (
                    <SelectItem key={i.id} value={i.id} preview={<TagCanvas bitmap={renderIconBox(i, iconStyle)} scale={2} />}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {myIcons.length > 0 && (
                  <SelectGroup label="My icons">
                    {myIcons.map((i) => (
                      <SelectItem key={i.id} value={i.id} preview={<TagCanvas bitmap={renderIconBox(i, iconStyle)} scale={2} />}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </Select>
            </div>
            <button type="button" className="btn shrink-0" onClick={() => setEditor("icons")}>
              <Pencil className="size-4" aria-hidden />
              Icons
            </button>
          </div>
        </Field>

        {icon && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <SwitchCard
                title="Sync icon background"
                description={ic.syncFrame ? "The icon box uses the tag's template style." : "Pick a different icon box style."}
                checked={ic.syncFrame}
                onChange={(syncFrame) => iconCfg.set({ syncFrame })}
              />
              <SwitchCard
                title="Sync icon colors"
                description={ic.syncColors ? "The icon box uses the rank tag colors." : "Set icon colors separately below."}
                checked={ic.syncColors}
                onChange={(syncColors) => iconCfg.set({ syncColors })}
              />
            </div>
            {!ic.syncFrame && (
              <Field label="Icon background style">
                <div className="sm:max-w-xs">
                  <FrameSelect label="Icon background style" value={ic.frameId} onChange={(frameId) => iconCfg.set({ frameId })} myFrames={myFrames} />
                </div>
              </Field>
            )}
            {!ic.syncColors && (
              <div className="flex flex-col gap-5 rounded-xl border border-line bg-raised/40 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gold-soft">Icon colors</span>
                <TintFields tint={ic} onChange={iconCfg.set} label="Icon background tint" />
              </div>
            )}
          </>
        )}
      </Section>

      {editor && (
        <Editor page={editor} onPageChange={setEditor} onClose={() => setEditor(null)}>
          {editor === "icons" ? (
            <IconEditor
              initial={icon?.pixels ?? null}
              style={iconStyle}
              myIcons={myIcons}
              onClose={() => setEditor(null)}
              onSave={(saved) => {
                saveMyIcons([...myIcons, saved]);
                iconCfg.set({ iconId: saved.id });
                setEditor(null);
              }}
              onDelete={(id) => saveMyIcons(myIcons.filter((i) => i.id !== id))}
            />
          ) : (
            <TemplateEditor
              initial={findFrame(b.frameId)}
              myFrames={myFrames}
              colors={tagColors}
              text={b.text}
              onClose={() => setEditor(null)}
              onSave={(saved) => {
                saveMyFrames([...myFrames, saved]);
                basics.set({ frameId: saved.id });
                setEditor(null);
              }}
              onDelete={(id) => saveMyFrames(myFrames.filter((f) => f.id !== id))}
            />
          )}
        </Editor>
      )}
    </div>
  );
}

function FrameSelect({ label, value, onChange, myFrames }: { label: string; value: string; onChange: (v: string) => void; myFrames: Frame[] }) {
  const options = (frames: Frame[]) =>
    frames.map((f) => (
      <SelectItem key={f.id} value={f.id} preview={<TagCanvas bitmap={renderTagBox({ text: "", textColor: "#ffffff", shadow: true, frame: f, colors: [BASE_HEX] })} scale={2} />}>
        {f.name}
      </SelectItem>
    ));
  return (
    <Select label={label} value={myFrames.some((f) => f.id === value) || FRAMES.some((f) => f.id === value) ? value : FRAMES[0].id} onChange={onChange}>
      <SelectGroup label="Templates">{options(FRAMES)}</SelectGroup>
      {myFrames.length > 0 && <SelectGroup label="My templates">{options(myFrames)}</SelectGroup>}
    </Select>
  );
}

function TintFields({ tint, onChange, label }: { tint: Tint; onChange: (patch: Partial<Tint>) => void; label: string }) {
  const gradient = tint.mode === "gradient";
  return (
    <>
      <Field label="Color mode">
        <Segmented label={`${label} color mode`} value={tint.mode} onChange={(mode) => onChange({ mode })} options={MODES} />
      </Field>
      <Field label={gradient ? `${label} left` : `${label} color`}>
        <ColorField label={gradient ? `${label} left` : label} value={tint.c1} onChange={(c1) => onChange({ c1 })} presets={TAG_PRESETS} />
      </Field>
      {gradient && (
        <Field label={`${label} right`}>
          <ColorField label={`${label} right`} value={tint.c2} onChange={(c2) => onChange({ c2 })} presets={TAG_PRESETS} />
        </Field>
      )}
    </>
  );
}
