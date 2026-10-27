"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { activateLicenseAction } from "@/app/actions/license";

const KEY_PATTERN = /^[0-9A-F]{4}(-[0-9A-F]{4}){5}$/;

// Uppercase, hex only, dashes every 4 characters as the user types or pastes.
const formatKey = (raw: string) =>
  (raw.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 24).match(/.{1,4}/g) ?? []).join("-");

export function LicenseRequired() {
  const [state, action, pending] = useActionState(activateLicenseAction, null);
  const [key, setKey] = useState("");
  const valid = KEY_PATTERN.test(key);

  return (
    <div className="card mx-auto mt-6 flex w-full max-w-md flex-col gap-5 p-8 sm:mt-14">
      <span className="grid size-12 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
        <KeyRound className="size-5" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">License Required</h1>
        <p className="text-sm leading-relaxed text-muted">
          You need a valid license key to access the generator. Enter your key below to activate your account.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="label">License key</span>
          <input
            name="key"
            value={key}
            onChange={(e) => setKey(formatKey(e.target.value))}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className="input rounded-full px-5 py-3 font-mono tracking-wide"
          />
        </label>
        <button type="submit" disabled={!valid || pending} className="btn-gold w-full rounded-full py-3">
          {pending ? "Activating…" : "Activate License"}
        </button>
        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-emerald-500" : "text-red-400"}`}>
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
