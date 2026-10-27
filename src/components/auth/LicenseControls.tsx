"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, UserMinus } from "lucide-react";
import { addDeveloperAction, removeDeveloperAction, type ActionResult } from "@/app/actions/license";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy license key"
      title="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked: the key stays selectable in the field
        }
      }}
      className="grid size-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
    >
      {copied ? <Check className="size-5 text-emerald-500" aria-hidden /> : <Copy className="size-5" aria-hidden />}
    </button>
  );
}

function Status({ state }: { state: ActionResult }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-emerald-500" : "text-red-400"}`}>
      {state.message}
    </p>
  );
}

export function DeveloperAccess({ developer, disabled }: { developer: { id: string; name: string | null } | null; disabled: boolean }) {
  const [addState, addAction, adding] = useActionState(addDeveloperAction, null);
  const [removeState, setRemoveState] = useState<ActionResult>(null);
  const [removing, startRemove] = useTransition();

  if (developer) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-raised/50 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{developer.name ?? "Not signed in yet"}</div>
            <div className="font-mono text-xs text-muted">{developer.id}</div>
          </div>
          <button
            type="button"
            className="btn py-2"
            disabled={removing}
            onClick={() => startRemove(async () => setRemoveState(await removeDeveloperAction()))}
          >
            <UserMinus className="size-4" aria-hidden />
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
        <Status state={removeState} />
      </div>
    );
  }

  return (
    <form action={addAction} className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          name="discordId"
          inputMode="numeric"
          pattern="\d{17,20}"
          required
          disabled={disabled}
          placeholder="Discord user ID (e.g. 123456789012345678)"
          aria-label="Developer Discord user ID"
          className="input rounded-full px-5 py-3 font-mono"
        />
        <button type="submit" className="btn-gold shrink-0 rounded-full px-6" disabled={disabled || adding}>
          {adding ? "Adding…" : "Add Developer"}
        </button>
      </div>
      <Status state={addState} />
    </form>
  );
}
