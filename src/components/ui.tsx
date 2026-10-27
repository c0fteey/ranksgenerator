"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Redo2, RotateCcw, Sparkles, Undo2, type LucideIcon } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import { HexColorInput, HexColorPicker } from "react-colorful";

interface HistoryControls {
  undo: () => void;
  redo: () => void;
  reset: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Section({
  icon: Icon,
  title,
  description,
  history,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  history?: HistoryControls;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {actions}
        {history && (
          <div className="flex shrink-0 gap-1">
            <IconButton label={`Undo ${title.toLowerCase()}`} onClick={history.undo} disabled={!history.canUndo} icon={Undo2} />
            <IconButton label={`Redo ${title.toLowerCase()}`} onClick={history.redo} disabled={!history.canRedo} icon={Redo2} />
            <IconButton label={`Reset ${title.toLowerCase()}`} onClick={history.reset} icon={RotateCcw} />
          </div>
        )}
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  active,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-30 ${
        active ? "bg-gold text-black" : "text-muted hover:bg-raised hover:text-ink"
      }`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gold-soft">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        aria-label={label}
        className="input group flex cursor-pointer items-center justify-between gap-3 text-left data-[state=open]:border-gold [&>span]:min-w-0"
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-[min(22rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-48 overflow-hidden rounded-xl border border-line bg-raised shadow-2xl shadow-black/60"
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-muted">
            <ChevronUp className="size-4" aria-hidden />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-muted">
            <ChevronDown className="size-4" aria-hidden />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <SelectPrimitive.Group className="[&+&]:mt-1.5 [&+&]:border-t [&+&]:border-line [&+&]:pt-1.5">
      <SelectPrimitive.Label className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-soft">{label}</SelectPrimitive.Label>
      {children}
    </SelectPrimitive.Group>
  );
}

export function SelectItem({ value, preview, children }: { value: string; preview?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg py-2 pl-3 pr-9 text-sm outline-none transition-colors data-[highlighted]:bg-gold/10 data-[state=checked]:text-gold data-[highlighted]:text-ink"
    >
      {/* ItemText is mirrored into the trigger, so the preview shows there too */}
      <SelectPrimitive.ItemText>
        <span className="flex min-w-0 items-center gap-2.5">
          {preview}
          <span className="truncate">{children}</span>
        </span>
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-3">
        <Check className="size-4 text-gold" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit gap-1 rounded-xl border border-line bg-raised p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            value === o.value ? "bg-gold text-black" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="relative inline-flex">
      <input type="checkbox" role="switch" aria-label={label} className="peer absolute inset-0 cursor-pointer opacity-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="pointer-events-none h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-gold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold before:absolute before:left-0.5 before:top-0.5 before:size-4 before:rounded-full before:bg-ink before:transition-transform peer-checked:before:translate-x-4"
      />
    </span>
  );
}

export function SwitchCard({
  title,
  description,
  checked,
  onChange,
  on = "Synced",
  off = "Separate",
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  on?: string;
  off?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-raised/40 p-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gold-soft">{title}</div>
        <div className="text-xs text-muted">{description}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
        {checked ? on : off}
        <Switch checked={checked} onChange={onChange} label={title} />
      </div>
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

function randomColor() {
  const h = Math.random() * 360;
  const s = 0.55 + Math.random() * 0.25;
  const l = 0.5 + Math.random() * 0.1;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function ColorField({
  value,
  onChange,
  presets,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  presets: string[];
  label: string;
}) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover.Root>
        <Popover.Trigger
          aria-label={`${label} picker`}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-line p-1 transition-colors hover:border-muted data-[state=open]:border-gold"
        >
          <span className="block size-full rounded-md border border-white/10" style={{ backgroundColor: value }} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="color-picker z-[60] flex w-64 flex-col gap-3 rounded-2xl border border-line bg-raised p-3 shadow-2xl shadow-black/60"
          >
            <HexColorPicker color={value} onChange={(v) => onChange(v.toLowerCase())} />
            <div className="flex items-center gap-2">
              <span className="size-9 shrink-0 rounded-lg border border-white/10" style={{ backgroundColor: value }} />
              <HexColorInput
                prefixed
                aria-label={`${label} picker hex`}
                color={value}
                onChange={(v) => onChange(v.toLowerCase())}
                className="input py-2 font-mono uppercase"
              />
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <input
        aria-label={`${label} hex`}
        value={draft}
        maxLength={7}
        spellCheck={false}
        className="input w-28 font-mono"
        onChange={(e) => {
          const v = e.target.value.trim();
          setDraft(v);
          if (HEX.test(v)) onChange(v.toLowerCase());
        }}
        onBlur={() => setDraft(value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Use ${c}`}
            onClick={() => onChange(c)}
            className={`size-7 rounded-full border border-white/15 ring-2 ring-offset-2 ring-offset-surface transition ${value === c ? "ring-gold" : "ring-transparent hover:ring-line"}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          type="button"
          title="Random color"
          aria-label="Random color"
          onClick={() => onChange(randomColor())}
          className="grid size-7 place-items-center rounded-full text-gold hover:bg-raised"
        >
          <Sparkles className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
