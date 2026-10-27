"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Check, Clock, Copy, Database, ExternalLink, KeyRound, Lock, Rocket, Wrench } from "lucide-react";
import { checkBotStep, checkDatabaseStep, checkDiscordStep, finishSetup, unlockSetup, type SetupResult } from "@/app/setup/actions";
import { DiscordIcon } from "@/components/auth/SignInButton";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SITE_NAME } from "@/lib/site";

export interface EnvPresence {
  database: boolean;
  discordApp: boolean;
  bot: boolean;
  siteUrl: boolean;
}

type StepId = "unlock" | "database" | "discord" | "bot" | "finish";

const STEP_META: Record<StepId, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  unlock: { label: "Unlock", icon: Lock },
  database: { label: "Database", icon: Database },
  discord: { label: "Discord app", icon: DiscordIcon },
  bot: { label: "Bot", icon: Wrench },
  finish: { label: "Finish", icon: Rocket },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      {children}
    </main>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="grid size-16 place-items-center rounded-2xl border border-line bg-raised">
        <Logo scale={4} />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Set up {SITE_NAME}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

function Feedback({ state }: { state: SetupResult }) {
  if (!state) return null;
  return (
    <div role="status" className={`rounded-xl border px-4 py-2.5 text-sm ${state.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
      {state.message}
      {state.detail && <div className="mt-1 break-all font-mono text-xs opacity-80">{state.detail}</div>}
    </div>
  );
}

function CopyLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-raised/60 py-1.5 pl-4 pr-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
      <button
        type="button"
        aria-label="Copy"
        title="Copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard blocked; the text is selectable
          }
        }}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
      >
        {copied ? <Check className="size-4 text-emerald-500" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-gold underline-offset-2 hover:underline">
    {children}
    <ExternalLink className="size-3" aria-hidden />
  </a>
);

// Set when the wizard finishes; until the new deployment is live this page still shows up.
const FINISHED_KEY = "setup-finished-at";
const RECENT_MS = 10 * 60_000;
// Snapshot for useSyncExternalStore: true while the wizard finished within RECENT_MS.
const finishedRecently = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(FINISHED_KEY) ?? 0) < RECENT_MS;
  } catch {
    return false;
  }
};

export function SetupWizard({ mode, has, missing, defaultSiteUrl }: { mode: "vercel" | "local"; has: EnvPresence; missing: string[]; defaultSiteUrl: string }) {
  const finished = useSyncExternalStore(
    () => () => {},
    finishedRecently,
    () => false,
  );
  const [restart, setRestart] = useState(false);
  const justFinished = finished && !restart;
  const steps: StepId[] = [
    ...(mode === "vercel" ? (["unlock"] as const) : []),
    ...(has.database ? [] : (["database"] as const)),
    ...(has.discordApp ? [] : (["discord"] as const)),
    ...(has.bot ? [] : (["bot"] as const)),
    "finish",
  ];
  const [index, setIndex] = useState(0);
  const [token, setToken] = useState("");
  const [v, setV] = useState({ databaseUrl: "", clientId: "", clientSecret: "", botToken: "", guildId: "", siteUrl: defaultSiteUrl });
  const [state, setState] = useState<SetupResult>(null);
  const [done, setDone] = useState<{ message: string; botApiSecret?: string } | null>(null);
  const [pending, start] = useTransition();

  const step = steps[index];
  const set = (patch: Partial<typeof v>) => setV({ ...v, ...patch });
  const siteUrl = v.siteUrl.replace(/\/+$/, "");
  const redirectUrl = `${siteUrl}/api/auth/callback/discord`;

  // Run a server check; move on only when it passes.
  const run = (check: () => Promise<SetupResult>) =>
    start(async () => {
      const result = await check();
      setState(result);
      if (result?.ok) {
        setIndex((i) => Math.min(i + 1, steps.length - 1));
        setState(null);
      }
    });

  if (justFinished && !done) {
    return (
      <Shell>
        <div className="card flex w-full max-w-xl flex-col items-center gap-5 p-8 text-center sm:p-10">
          <span className="grid size-14 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
            <Clock className="size-7" aria-hidden />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Almost there</h1>
            <p className="text-sm leading-relaxed text-muted">
              {mode === "vercel"
                ? "Your settings were saved and a new deployment is building. Until it's live (usually 1–2 minutes) this address still serves the old one, so you see this page."
                : "Your settings were saved to .env.local. If this page stays, restart the dev server."}
            </p>
          </div>
          <MissingList missing={missing} />
          {mode === "vercel" && (
            <p className="text-xs leading-relaxed text-muted">
              Taking longer? In Vercel → Deployments, check that the newest deployment is “Ready”, or redeploy it. Under Settings → Environment Variables the names above must exist for Production.
            </p>
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => window.location.reload()} className="btn-gold flex-1 rounded-full">
              Refresh
            </button>
            <button type="button" onClick={() => setRestart(true)} className="btn flex-1 rounded-full">
              Run the wizard again
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="card flex w-full max-w-xl flex-col gap-6 p-8 sm:p-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
              <Check className="size-7" aria-hidden />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Setup complete</h1>
            <p className="text-sm leading-relaxed text-muted">{done.message}</p>
          </div>
          {done.botApiSecret && (
            <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-gold/5 p-4">
              <span className="label">Bot API secret</span>
              <p className="text-xs text-muted">Your bot sends this as <code className="font-mono">Authorization: Bearer …</code> to /api/bot/licenses. Copy it now; it isn&apos;t shown again.</p>
              <CopyLine value={done.botApiSecret} />
            </div>
          )}
          {mode === "vercel" && (
            <p className="text-xs leading-relaxed text-muted">
              Optional clean-up: once the site works, you can delete SETUP_TOKEN and VERCEL_TOKEN from Vercel. The wizard stays closed either way.
            </p>
          )}
          {/* Full reload: once configured, /setup redirects to the site. */}
          <button type="button" onClick={() => window.location.reload()} className="btn-gold w-full rounded-full py-3">
            Open the site
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header subtitle={mode === "vercel" ? "A few details and your site is live." : "Local setup: values are saved to .env.local."} />
      <div className="w-full max-w-xl">
        <MissingList missing={missing} />
      </div>

      <ol className="flex w-full max-w-xl items-center justify-center gap-1 sm:gap-2" aria-label="Setup steps">
        {steps.map((id, i) => {
          const { label, icon: Icon } = STEP_META[id];
          const state = i < index ? "done" : i === index ? "current" : "todo";
          return (
            <li key={id} className="flex items-center gap-1 sm:gap-2">
              {i > 0 && <span className={`h-px w-4 sm:w-8 ${i <= index ? "bg-gold/60" : "bg-line"}`} />}
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  state === "current" ? "border-gold/50 bg-gold/10 text-gold" : state === "done" ? "border-emerald-500/30 text-emerald-500" : "border-line text-muted"
                }`}
              >
                {state === "done" ? <Check className="size-3.5" aria-hidden /> : <Icon className="size-3.5" />}
                <span className="hidden sm:inline">{label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <form
        className="card flex w-full max-w-xl flex-col gap-5 p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "unlock") run(() => unlockSetup(token));
          else if (step === "database") run(() => checkDatabaseStep(token, v.databaseUrl));
          else if (step === "discord") run(() => checkDiscordStep(token, v.clientId, v.clientSecret));
          else if (step === "bot") run(() => checkBotStep(token, v.botToken, v.guildId));
          else
            start(async () => {
              const result = await finishSetup(token, v);
              setState(result);
              if (result?.ok) {
                setDone({ message: result.message, botApiSecret: result.botApiSecret });
                try {
                  sessionStorage.setItem(FINISHED_KEY, String(Date.now()));
                } catch {
                  // storage blocked: the waiting screen just won't show
                }
              }
            });
        }}
      >
        {step === "unlock" && (
          <>
            <StepTitle icon={KeyRound} title="Enter your setup token" text="The SETUP_TOKEN you added in Vercel. It keeps strangers out of this wizard." />
            <Field label="Setup token">
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoFocus autoComplete="off" className="input rounded-full px-5 py-3 font-mono" />
            </Field>
          </>
        )}

        {step === "database" && (
          <>
            <StepTitle icon={Database} title="Connect the database" text="One Postgres connection string holds the host, user and password." />
            <Field
              label="Database URL"
              hint={
                <>
                  Easiest: Vercel → your project → Storage → add Neon (then this step disappears). Or create a project on <A href="https://console.neon.tech">neon.tech</A> and copy the <b>pooled</b> connection string (it contains <code className="font-mono">-pooler</code>).
                </>
              }
            >
              <input type="password" value={v.databaseUrl} onChange={(e) => set({ databaseUrl: e.target.value })} placeholder="postgresql://user:password@host/db?sslmode=require" autoFocus autoComplete="off" className="input font-mono" />
            </Field>
          </>
        )}

        {step === "discord" && (
          <>
            <StepTitle icon={DiscordIcon} title="Connect your Discord app" text="Used for “Sign in with Discord”." />
            <p className="text-xs leading-relaxed text-muted">
              Open the <A href="https://discord.com/developers/applications">Discord Developer Portal</A> → your application (or New Application) → OAuth2. Copy the Client ID and Client Secret, and add this redirect:
            </p>
            <CopyLine value={redirectUrl} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client ID">
                <input value={v.clientId} onChange={(e) => set({ clientId: e.target.value.replace(/\D/g, "").slice(0, 20) })} inputMode="numeric" autoFocus className="input font-mono" />
              </Field>
              <Field label="Client secret">
                <input type="password" value={v.clientSecret} onChange={(e) => set({ clientSecret: e.target.value.trim() })} autoComplete="off" className="input font-mono" />
              </Field>
            </div>
          </>
        )}

        {step === "bot" && (
          <>
            <StepTitle icon={Wrench} title="Connect the bot" text="Reads members' Discord roles so roles can grant access. Optional: you can skip it and add it later." />
            {(v.clientId || has.discordApp) && (
              <>
                <p className="text-xs text-muted">Invite the bot to your server first:</p>
                {v.clientId ? (
                  <a href={`https://discord.com/oauth2/authorize?client_id=${v.clientId}&scope=bot`} target="_blank" rel="noreferrer" className="btn w-fit rounded-full">
                    <DiscordIcon className="size-4" />
                    Invite bot
                  </a>
                ) : (
                  <p className="text-xs text-muted">Developer Portal → OAuth2 → URL Generator → scope “bot”.</p>
                )}
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bot token" hint="Developer Portal → Bot → Reset Token.">
                <input type="password" value={v.botToken} onChange={(e) => set({ botToken: e.target.value.trim() })} autoComplete="off" autoFocus className="input font-mono" />
              </Field>
              <Field label="Server ID" hint="Discord → Settings → Advanced → Developer Mode, then right-click your server → Copy Server ID.">
                <input value={v.guildId} onChange={(e) => set({ guildId: e.target.value.replace(/\D/g, "").slice(0, 20) })} inputMode="numeric" className="input font-mono" />
              </Field>
            </div>
          </>
        )}

        {step === "finish" && (
          <>
            <StepTitle icon={Rocket} title="Finish setup" text="Creates the database tables, generates the secret keys and saves everything." />
            {!has.siteUrl && (
              <Field label="Site address" hint="Filled in from this page. Change it only if the site will use a different domain.">
                <input value={v.siteUrl} onChange={(e) => set({ siteUrl: e.target.value.trim() })} className="input font-mono" />
              </Field>
            )}
            <ul className="flex flex-col gap-2 text-sm">
              <Summary ok label="Database" value={has.database ? "set in Vercel" : "connected"} />
              <Summary ok label="Discord app" value={has.discordApp ? "already set" : "verified"} />
              <Summary ok={has.bot || !!v.botToken} label="Bot" value={has.bot ? "already set" : v.botToken ? "verified" : "skipped (roles won't grant access)"} />
              <Summary ok label="Secret keys" value="generated automatically" />
            </ul>
            <p className="text-xs leading-relaxed text-muted">
              Make sure the Discord redirect <code className="break-all font-mono">{redirectUrl}</code> is added in the Developer Portal.
            </p>
          </>
        )}

        <Feedback state={state} />

        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn rounded-full" disabled={index === 0 || pending} onClick={() => {
              setIndex(index - 1);
              setState(null);
            }}>
            Back
          </button>
          <div className="flex gap-2">
            {step === "bot" && (
              <button type="button" className="btn rounded-full" disabled={pending} onClick={() => {
                  set({ botToken: "", guildId: "" });
                  setIndex(index + 1);
                  setState(null);
                }}>
                Skip
              </button>
            )}
            <button type="submit" className="btn-gold rounded-full px-6" disabled={pending}>
              {pending ? "Checking…" : step === "finish" ? "Finish setup" : "Continue"}
            </button>
          </div>
        </div>
      </form>
    </Shell>
  );
}

function MissingList({ missing }: { missing: string[] }) {
  if (!missing.length) return null;
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-line bg-raised/50 p-4 text-left">
      <span className="label">This deployment is missing</span>
      <div className="flex flex-wrap gap-1.5">
        {missing.map((name) => (
          <code key={name} className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs">
            {name}
          </code>
        ))}
      </div>
    </div>
  );
}

function StepTitle({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}

function Summary({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className={`grid size-5 place-items-center rounded-full ${ok ? "bg-emerald-500/15 text-emerald-500" : "bg-raised text-muted"}`}>
        <Check className="size-3" aria-hidden />
      </span>
      <span className="font-medium">{label}</span>
      <span className="text-muted">— {value}</span>
    </li>
  );
}

const BLOCKED: Record<string, { title: string; steps: React.ReactNode[] }> = {
  "missing-vercel-token": {
    title: "One more thing in Vercel",
    steps: [
      <>
        Create a token at <A href="https://vercel.com/account/tokens">vercel.com/account/tokens</A> (scope: the team that owns this project).
      </>,
      <>Vercel → this project → Settings → Environment Variables: add <code className="font-mono">VERCEL_TOKEN</code> with that token.</>,
      <>Also add <code className="font-mono">SETUP_TOKEN</code>: any password of at least 16 characters. You&apos;ll type it here.</>,
      <>Deployments → Redeploy, then reload this page.</>,
    ],
  },
  "missing-setup-token": {
    title: "Add a setup token in Vercel",
    steps: [
      <>Vercel → this project → Settings → Environment Variables: add <code className="font-mono">SETUP_TOKEN</code>, any password of at least 16 characters.</>,
      <>Deployments → Redeploy, then reload this page and enter it.</>,
    ],
  },
  "not-local": {
    title: "Site setup incomplete",
    steps: [<>Set the environment variables listed in .env.example on the server (or run npm run setup), then restart.</>],
  },
};

export function SetupBlocked({ reason }: { reason: string }) {
  const info = BLOCKED[reason] ?? BLOCKED["not-local"];
  return (
    <Shell>
      <Header subtitle={reason === "not-local" ? "This server is missing its configuration." : "The setup wizard needs a setting in Vercel before it can open."} />
      <div className="card flex w-full max-w-xl flex-col gap-4 p-6 sm:p-8">
        <h2 className="font-semibold">{info.title}</h2>
        <ol className="flex flex-col gap-3">
          {info.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 text-xs font-semibold text-gold">{i + 1}</span>
              <span className="text-muted">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </Shell>
  );
}
