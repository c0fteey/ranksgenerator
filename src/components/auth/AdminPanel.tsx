"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, Check, Copy, Lock, Pencil, Search, Trash2 } from "lucide-react";
import { createLicensesAction, revokeLicenseAction, saveAccountGrant, saveRolePermissions } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/license";
import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/access/permissions";
import { Segmented, Select, SelectItem } from "../ui";
import { SeoTab, type SeoData } from "./SeoPanel";

type Person = { id: string; name: string | null };
type Status = "unused" | "active" | "expired" | "revoked";

export interface AdminData {
  viewerPermissions: Permission[];
  roles: { available: boolean; list: { id: string; name: string; color: string | null; managed: boolean; permissions: Permission[] }[] } | null;
  accounts: {
    owners: Person[];
    code: (Person & { permissions: Permission[] })[];
    grants: (Person & { note: string | null; permissions: Permission[]; updatedAt: string })[];
  } | null;
  licenses:
    | { key: string; status: Status; durationDays: number | null; owner: Person | null; developer: Person | null; note: string | null; createdAt: string; expiresAt: string | null }[]
    | null;
  seo: SeoData | null;
  activity: { id: string; actor: string; actorName: string | null; action: string; target: string | null; details: string | null; at: string }[];
}

type Tab = "roles" | "accounts" | "licenses" | "seo" | "activity";

export function AdminPanel({ data }: { data: AdminData }) {
  const tabs = [
    data.roles && { value: "roles" as Tab, label: "Roles" },
    data.accounts && { value: "accounts" as Tab, label: "Accounts" },
    data.licenses && { value: "licenses" as Tab, label: "Licenses" },
    data.seo && { value: "seo" as Tab, label: "SEO" },
    { value: "activity" as Tab, label: "Activity" },
  ].filter((t): t is { value: Tab; label: string } => !!t);
  const [tab, setTab] = useState<Tab>(tabs[0].value);
  const held = new Set(data.viewerPermissions);

  return (
    <div className="flex flex-col gap-5">
      <Segmented label="Admin section" value={tab} onChange={setTab} options={tabs} />
      {tab === "roles" && data.roles && <RolesTab roles={data.roles} held={held} />}
      {tab === "accounts" && data.accounts && <AccountsTab accounts={data.accounts} held={held} />}
      {tab === "licenses" && data.licenses && <LicensesTab licenses={data.licenses} />}
      {tab === "seo" && data.seo && <SeoTab seo={data.seo} />}
      {tab === "activity" && <ActivityTab activity={data.activity} />}
    </div>
  );
}

function Feedback({ state }: { state: ActionResult }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-emerald-500" : "text-red-400"}`}>
      {state.message}
    </p>
  );
}

const who = (p: Person) => p.name ?? "Unknown user";

/** Toggle pills for permissions; ones the viewer doesn't hold are locked (they can't grant or revoke them). */
function PermissionPicker({ value, onChange, held }: { value: Permission[]; onChange: (v: Permission[]) => void; held: Set<Permission> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_PERMISSIONS.map((p) => {
        const on = value.includes(p);
        const locked = !held.has(p);
        return (
          <button
            key={p}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={locked}
            title={locked ? "You don't have this permission, so you can't change it." : PERMISSIONS[p].description}
            onClick={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "border-gold/50 bg-gold/15 text-gold" : "border-line text-muted hover:border-muted hover:text-ink"
            }`}
          >
            {locked ? <Lock className="size-3" aria-hidden /> : on && <Check className="size-3" aria-hidden />}
            {PERMISSIONS[p].label}
          </button>
        );
      })}
    </div>
  );
}

function RolesTab({ roles, held }: { roles: NonNullable<AdminData["roles"]>; held: Set<Permission> }) {
  const [filter, setFilter] = useState("");
  if (!roles.available)
    return (
      <div className="card p-6 text-sm text-muted">
        The bot couldn&apos;t read the server&apos;s roles. Check DISCORD_BOT_TOKEN and DISCORD_GUILD_ID, and that the bot is in the server.
      </div>
    );
  const shown = roles.list.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Discord role permissions</h2>
          <p className="text-sm text-muted">Members holding a role get its permissions. Changes apply within a minute.</p>
        </div>
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search roles" aria-label="Search roles" className="input py-2 pl-9" />
        </label>
      </div>
      <div className="scroll-area flex flex-col divide-y divide-line">
        {shown.map((r) => (
          <RoleRow key={r.id} role={r} held={held} />
        ))}
        {!shown.length && <p className="py-4 text-sm text-muted">No roles match.</p>}
      </div>
    </section>
  );
}

function RoleRow({ role, held }: { role: NonNullable<AdminData["roles"]>["list"][number]; held: Set<Permission> }) {
  const [value, setValue] = useState(role.permissions);
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const dirty = value.length !== role.permissions.length || value.some((p) => !role.permissions.includes(p));
  return (
    <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="size-3 shrink-0 rounded-full border border-white/10" style={{ backgroundColor: role.color ?? "var(--color-muted)" }} />
        <span className="truncate font-medium">@{role.name}</span>
        {role.managed && <span className="rounded-full border border-line px-2 text-[11px] text-muted">bot</span>}
      </div>
      <div className="flex flex-col gap-2 lg:items-end">
        <div className="flex flex-wrap items-center gap-3">
          <PermissionPicker value={value} onChange={setValue} held={held} />
          <button
            type="button"
            className="btn-gold px-4 py-1.5 text-xs"
            disabled={!dirty || pending}
            onClick={() => start(async () => setState(await saveRolePermissions(role.id, value)))}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        <Feedback state={state} />
      </div>
    </div>
  );
}

function AccountsTab({ accounts, held }: { accounts: NonNullable<AdminData["accounts"]>; held: Set<Permission> }) {
  const [form, setForm] = useState({ id: "", note: "", permissions: [] as Permission[] });
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const submit = (id: string, permissions: Permission[], note: string) =>
    start(async () => {
      const result = await saveAccountGrant(id, permissions, note);
      setState(result);
      if (result?.ok) setForm({ id: "", note: "", permissions: [] });
    });

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Grant access to an account</h2>
          <p className="text-sm text-muted">Give a Discord account permissions directly, no role needed. Saving with nothing selected removes it.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value.replace(/\D/g, "").slice(0, 20) })}
            placeholder="Discord user ID"
            aria-label="Discord user ID"
            inputMode="numeric"
            className="input font-mono"
          />
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional)" aria-label="Note" maxLength={100} className="input" />
        </div>
        <PermissionPicker value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} held={held} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-gold" disabled={pending || form.id.length < 17} onClick={() => submit(form.id, form.permissions, form.note)}>
            {pending ? "Saving…" : "Save access"}
          </button>
          <Feedback state={state} />
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-5 sm:p-6">
        <h2 className="font-semibold">Accounts with access</h2>
        <div className="flex flex-col divide-y divide-line">
          {accounts.owners.map((o) => (
            <AccountLine key={`owner-${o.id}`} person={o} badge="Owner" detail="Every permission" />
          ))}
          {accounts.code.map((c) => (
            <AccountLine key={`code-${c.id}`} person={c} badge="Code" detail={c.permissions.map((p) => PERMISSIONS[p].label).join(", ")} />
          ))}
          {accounts.grants.map((g) => (
            <AccountLine key={g.id} person={g} detail={[g.permissions.map((p) => PERMISSIONS[p].label).join(", "), g.note].filter(Boolean).join(" · ")}>
              <button type="button" className="btn px-3 py-1.5 text-xs" onClick={() => setForm({ id: g.id, note: g.note ?? "", permissions: g.permissions })}>
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </button>
              <button
                type="button"
                className="btn px-3 py-1.5 text-xs hover:border-red-500/50 hover:text-red-400"
                disabled={pending}
                onClick={() => confirm(`Remove all access granted to ${who(g)} (${g.id})?`) && submit(g.id, [], "")}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove
              </button>
            </AccountLine>
          ))}
        </div>
        <p className="text-xs text-muted">Owners and code grants are set in src/lib/access/config.ts (or OWNER_DISCORD_IDS) and can&apos;t be changed here.</p>
      </section>
    </div>
  );
}

function AccountLine({ person, badge, detail, children }: { person: Person; badge?: string; detail: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{who(person)}</span>
          {badge && <span className="rounded-full border border-gold/40 bg-gold/10 px-2 text-[11px] font-semibold text-gold">{badge}</span>}
        </div>
        <div className="font-mono text-xs text-muted">{person.id}</div>
        <div className="text-xs text-muted">{detail}</div>
      </div>
      {children && <div className="flex shrink-0 gap-2">{children}</div>}
    </div>
  );
}

const DURATIONS = [
  { value: "lifetime", label: "Lifetime" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

const STATUS_STYLE: Record<Status, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  expired: "border-red-500/40 bg-red-500/10 text-red-400",
  revoked: "border-red-500/40 bg-red-500/10 text-red-400",
  unused: "border-line bg-raised text-muted",
};

function LicensesTab({ licenses }: { licenses: NonNullable<AdminData["licenses"]> }) {
  const [form, setForm] = useState({ duration: "lifetime", count: 1, note: "", assignTo: "" });
  const [created, setCreated] = useState<string[]>([]);
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return licenses;
    return licenses.filter((l) =>
      [l.key, l.status, l.note, l.owner?.id, l.owner?.name, l.developer?.id, l.developer?.name].some((v) => v?.toLowerCase().includes(f)),
    );
  }, [licenses, filter]);

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Create license keys</h2>
          <p className="text-sm text-muted">The duration starts when a key is activated. Assigning activates it for that account right away.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <span className="label">Duration</span>
            <Select label="Duration" value={form.duration} onChange={(duration) => setForm({ ...form, duration })}>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </Select>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="label">Count</span>
            <input
              type="number"
              min={1}
              max={25}
              value={form.count}
              disabled={!!form.assignTo}
              onChange={(e) => setForm({ ...form, count: Math.max(1, Math.min(25, Number(e.target.value) || 1)) })}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Assign to (optional)</span>
            <input
              value={form.assignTo}
              onChange={(e) => setForm({ ...form, assignTo: e.target.value.replace(/\D/g, "").slice(0, 20), count: 1 })}
              placeholder="Discord user ID"
              inputMode="numeric"
              className="input font-mono"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Note (optional)</span>
            <input value={form.note} maxLength={100} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-gold"
            disabled={pending || (!!form.assignTo && form.assignTo.length < 17)}
            onClick={() =>
              start(async () => {
                const result = await createLicensesAction({
                  durationDays: form.duration === "lifetime" ? null : Number(form.duration),
                  count: form.count,
                  note: form.note,
                  assignTo: form.assignTo,
                });
                setState(result);
                setCreated(result?.keys ?? []);
              })
            }
          >
            {pending ? "Creating…" : "Create"}
          </button>
          <Feedback state={state} />
        </div>
        {created.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-gold/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="label">New keys</span>
              <CopyText text={created.join("\n")} label="Copy all" />
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm">{created.join("\n")}</pre>
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold">Licenses</h2>
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search key, user, status, note" aria-label="Search licenses" className="input py-2 pl-9" />
          </label>
        </div>
        <div className="scroll-area flex flex-col divide-y divide-line">
          {shown.map((l) => (
            <LicenseLine key={l.key} license={l} />
          ))}
          {!shown.length && <p className="py-4 text-sm text-muted">No licenses.</p>}
        </div>
      </section>
    </div>
  );
}

function LicenseLine({ license: l }: { license: NonNullable<AdminData["licenses"]>[number] }) {
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{l.key}</span>
          <CopyText text={l.key} label="Copy" />
          <span className={`rounded-full border px-2 text-[11px] font-semibold capitalize ${STATUS_STYLE[l.status]}`}>{l.status}</span>
        </div>
        <div className="text-xs text-muted">
          {l.durationDays ? `${l.durationDays} days` : "Lifetime"}
          {l.expiresAt && ` · expires ${l.expiresAt}`} · created {l.createdAt}
          {l.note && ` · ${l.note}`}
        </div>
        <div className="text-xs text-muted">
          {l.owner ? `Owner: ${who(l.owner)} (${l.owner.id})` : "Not activated"}
          {l.developer && ` · Developer: ${who(l.developer)} (${l.developer.id})`}
        </div>
        <Feedback state={state} />
      </div>
      {l.status !== "revoked" && (
        <button
          type="button"
          className="btn shrink-0 px-3 py-1.5 text-xs hover:border-red-500/50 hover:text-red-400"
          disabled={pending}
          onClick={() => confirm(`Revoke ${l.key}? Its owner and developer lose access immediately.`) && start(async () => setState(await revokeLicenseAction(l.key)))}
        >
          <Ban className="size-3.5" aria-hidden />
          {pending ? "Revoking…" : "Revoke"}
        </button>
      )}
    </div>
  );
}

function CopyText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-raised hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {label !== "Copy" && label}
    </button>
  );
}

function ActivityTab({ activity }: { activity: AdminData["activity"] }) {
  return (
    <section className="card flex flex-col gap-3 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">Activity</h2>
        <p className="text-sm text-muted">The last 100 security-relevant actions.</p>
      </div>
      <div className="scroll-area flex flex-col divide-y divide-line">
        {activity.map((a) => (
          <div key={a.id} className="flex flex-col gap-0.5 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-mono text-xs text-gold">{a.action}</span>
              {a.target && <span className="font-mono text-xs">{a.target}</span>}
            </div>
            <div className="text-xs text-muted">
              {a.at} · {a.actor === "bot" ? "Bot" : `${a.actorName ?? "Unknown user"} (${a.actor})`}
            </div>
            {a.details && <div className="break-all font-mono text-[11px] text-muted">{a.details}</div>}
          </div>
        ))}
        {!activity.length && <p className="py-4 text-sm text-muted">Nothing yet.</p>}
      </div>
    </section>
  );
}
