"use client";

import { useRef, useState, useTransition } from "react";
import { ImageUp, RotateCcw } from "lucide-react";
import { saveSeoAction, uploadSeoImageAction } from "@/app/actions/seo";
import type { ActionResult } from "@/app/actions/license";
import { PAGES, type PageId } from "@/lib/pages";
import { DEFAULT_SEO, SEO_IMAGE_MAX_BYTES, SEO_IMAGE_TYPES, SEO_LIMITS, seoImagePath, type SeoImageMode, type SeoImageTheme, type SeoPageText, type SeoSettings } from "@/lib/seo";
import { ColorField, Field, Segmented, Switch } from "../ui";

export interface SeoData {
  settings: SeoSettings;
  siteUrl: string;
}

const IMAGE_MODES: { value: SeoImageMode; label: string }[] = [
  { value: "default", label: "Themed" },
  { value: "upload", label: "Upload" },
  { value: "url", label: "URL" },
  { value: "none", label: "None" },
];

const IMAGE_THEMES: { value: SeoImageTheme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const PAGE_IDS = Object.keys(PAGES) as PageId[];

const COLOR_PRESETS = ["#e2b33c", "#5865f2", "#57f287", "#ed4245", "#eb459e", "#ffffff"];

export function SeoTab({ seo }: { seo: SeoData }) {
  const [saved, setSaved] = useState(seo.settings);
  const [form, setForm] = useState(seo.settings);
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setPage = (id: PageId, patch: Partial<SeoPageText>) => setForm((f) => ({ ...f, pages: { ...f.pages, [id]: { ...f.pages[id], ...patch } } }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const apply = (result: Awaited<ReturnType<typeof saveSeoAction>>) => {
    setState(result);
    if (result?.settings) {
      setSaved(result.settings);
      setForm(result.settings);
    }
  };

  const upload = (file: File) => {
    if (!SEO_IMAGE_TYPES.includes(file.type as (typeof SEO_IMAGE_TYPES)[number])) return setState({ ok: false, message: "Use a PNG, JPG, WEBP or GIF image." });
    if (file.size > SEO_IMAGE_MAX_BYTES) return setState({ ok: false, message: "The image must be 4 MB or smaller." });
    const data = new FormData();
    data.set("image", file);
    start(async () => apply(await uploadSeoImageAction(data)));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex flex-col gap-5">
        <section className="card flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Search &amp; browser tab</h2>
            <p className="text-sm text-muted">Shown in the browser tab and in search results. Other pages show their own name in front, e.g. &quot;History · {form.siteName || form.title}&quot;.</p>
          </div>
          <Field label="Title" hint={`${form.title.length}/${SEO_LIMITS.title}`}>
            <input value={form.title} maxLength={SEO_LIMITS.title} onChange={(e) => set("title", e.target.value)} className="input" />
          </Field>
          <Field label="Description" hint={`${form.description.length}/${SEO_LIMITS.description}`}>
            <textarea value={form.description} maxLength={SEO_LIMITS.description} rows={2} onChange={(e) => set("description", e.target.value)} className="input resize-y" />
          </Field>
          <Field label="Keywords" hint="Comma separated.">
            <input value={form.keywords} maxLength={SEO_LIMITS.keywords} onChange={(e) => set("keywords", e.target.value)} className="input" />
          </Field>
          <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-raised/40 p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gold-soft">Search engines</div>
              <div className="text-xs text-muted">Allow Google and others to index the site.</div>
            </div>
            <Switch checked={form.indexable} onChange={(v) => set("indexable", v)} label="Allow indexing" />
          </div>
        </section>

        <section className="card flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Link embed</h2>
            <p className="text-sm text-muted">What Discord, X, WhatsApp and others show when someone shares a link to the site.</p>
          </div>
          <Field label="Site name" hint="Small line above the embed title.">
            <input value={form.siteName} maxLength={SEO_LIMITS.siteName} onChange={(e) => set("siteName", e.target.value)} className="input" />
          </Field>
          <Field label="Embed title" hint="Home page. Empty uses the title above.">
            <input value={form.embedTitle} maxLength={SEO_LIMITS.embedTitle} placeholder={form.title} onChange={(e) => set("embedTitle", e.target.value)} className="input" />
          </Field>
          <Field label="Embed description" hint="Home page. Empty uses the description above.">
            <textarea
              value={form.embedDescription}
              maxLength={SEO_LIMITS.embedDescription}
              rows={3}
              placeholder={form.description}
              onChange={(e) => set("embedDescription", e.target.value)}
              className="input resize-y"
            />
          </Field>
          <Field label="Color" hint="The bar on the left of Discord embeds, and the accent of the themed image.">
            <ColorField label="Embed color" value={form.color} onChange={(v) => set("color", v)} presets={COLOR_PRESETS} />
          </Field>
          <Field label="Image">
            <Segmented label="Embed image" value={form.imageMode} onChange={(v) => set("imageMode", v)} options={IMAGE_MODES} />
            {form.imageMode === "default" && (
              <div className="flex flex-wrap items-center gap-3">
                <Segmented label="Image theme" value={form.imageTheme} onChange={(v) => set("imageTheme", v)} options={IMAGE_THEMES} />
                <span className="text-xs text-muted">A card with the logo, site name and the page&apos;s name and description below, in the embed color.</span>
              </div>
            )}
            {form.imageMode === "upload" && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept={SEO_IMAGE_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) upload(file);
                  }}
                />
                <button type="button" className="btn" disabled={pending} onClick={() => fileRef.current?.click()}>
                  <ImageUp className="size-4" aria-hidden />
                  {pending ? "Uploading…" : saved.imageVersion > 0 ? "Replace image" : "Upload image"}
                </button>
                <span className="text-xs text-muted">PNG, JPG, WEBP or GIF, up to 4 MB. 1200×630 fits the large layout.</span>
              </div>
            )}
            {form.imageMode === "url" && (
              <input
                value={form.imageUrl}
                maxLength={SEO_LIMITS.imageUrl}
                placeholder="https://…/image.png"
                onChange={(e) => set("imageUrl", e.target.value.trim())}
                className="input font-mono"
              />
            )}
          </Field>
          {(form.imageMode === "upload" || form.imageMode === "url") && (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-raised/40 p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gold-soft">Large image</div>
                <div className="text-xs text-muted">Show the image full width under the text instead of a small thumbnail.</div>
              </div>
              <Switch checked={form.largeImage} onChange={(v) => set("largeImage", v)} label="Large image" />
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Pages</h2>
            <p className="text-sm text-muted">
              The big name and the line under it on each page&apos;s themed image. Other pages also use them as their embed title and description.
            </p>
          </div>
          <div className="flex flex-col divide-y divide-line">
            {PAGE_IDS.map((id) => (
              <div key={id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <Field label={PAGES[id].path}>
                  <input
                    value={form.pages[id].title}
                    maxLength={SEO_LIMITS.pageTitle}
                    placeholder={DEFAULT_SEO.pages[id].title}
                    aria-label={`${PAGES[id].path} name`}
                    onChange={(e) => setPage(id, { title: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Description">
                  <input
                    value={form.pages[id].description}
                    maxLength={SEO_LIMITS.pageDescription}
                    aria-label={`${PAGES[id].path} description`}
                    onChange={(e) => setPage(id, { description: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-gold" disabled={!dirty || pending} onClick={() => start(async () => apply(await saveSeoAction(form)))}>
            {pending ? "Saving…" : "Save SEO settings"}
          </button>
          <button type="button" className="btn" disabled={!dirty || pending} onClick={() => setForm(saved)}>
            Discard changes
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => setForm({ ...DEFAULT_SEO, imageVersion: saved.imageVersion })}
            title="Fill the form with the default values. Nothing changes until you save."
          >
            <RotateCcw className="size-4" aria-hidden />
            Defaults
          </button>
          <Feedback state={state} />
        </div>
      </div>

      <Preview form={form} saved={saved} siteUrl={seo.siteUrl} />
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

const PREVIEW_PAGES = Object.entries(PAGES).map(([value, p]) => ({ value: value as PageId, label: p.title }));

/** Discord-style embed and Google result, from the form as it is now (before saving). */
function Preview({ form, saved, siteUrl }: { form: SeoSettings; saved: SeoSettings; siteUrl: string }) {
  const [page, setPage] = useState<PageId>("home");
  const info = form.pages[page];
  const home = page === "home";
  const tabTitle = home ? form.title : `${info.title} · ${form.siteName || form.title}`;
  const title = home ? form.embedTitle || form.title : tabTitle;
  const description = home ? form.embedDescription || form.description : info.description;
  // The themed image is drawn from saved settings, so it reflects color/name changes after saving.
  const image = seoImagePath(form.imageMode === "upload" ? { ...form, imageVersion: saved.imageVersion } : form.imageMode === "default" ? saved : form, page);
  const themed = !!image && image.startsWith("/api/og");
  const large = !!image && (themed || form.largeImage);
  const url = `${siteUrl}${PAGES[page].path}`;
  const drawn = (s: SeoSettings) => JSON.stringify([s.siteName, s.title, s.color, s.imageTheme, s.pages]);
  const themedStale = form.imageMode === "default" && drawn(form) !== drawn(saved);

  return (
    <aside className="flex flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">Preview</h2>
          <Segmented label="Preview page" value={page} onChange={setPage} options={PREVIEW_PAGES} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="label">Discord</span>
          <div className="rounded-lg bg-[#313338] p-3 text-[#dbdee1]">
            <div className="text-sm text-[#00a8fc] underline-offset-2">{url}</div>
            <div className="mt-2 flex max-w-[432px] overflow-hidden rounded bg-[#2b2d31]" style={{ borderLeft: `4px solid ${form.color}` }}>
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 pr-4">
                <div className="flex gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {form.siteName && <span className="text-xs text-[#b5bac1]">{form.siteName}</span>}
                    <span className="break-words text-[15px] font-semibold text-[#00a8fc]">{title}</span>
                    {description && <span className="whitespace-pre-line break-words text-sm text-[#dbdee1]">{description}</span>}
                  </div>
                  {image && !large && (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin URLs, not optimizable
                    <img src={image} alt="" className="size-20 shrink-0 rounded object-cover" />
                  )}
                </div>
                {image && large && (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin URLs, not optimizable
                  <img src={image} alt="" className="mt-1 w-full rounded object-cover" />
                )}
              </div>
            </div>
          </div>
          {themedStale && <span className="text-xs text-muted">Save to redraw the themed image with your changes.</span>}
        </div>

        <div className="flex flex-col gap-2">
          <span className="label">Google</span>
          <div className="rounded-lg border border-line bg-white p-4 text-left">
            <div className="truncate text-xs text-[#4d5156]">{url}</div>
            <div className="mt-1 text-lg leading-snug text-[#1a0dab]">{tabTitle}</div>
            <div className="mt-1 line-clamp-2 text-sm text-[#4d5156]">{home ? form.description : info.description}</div>
          </div>
          {!form.indexable && <span className="text-xs text-red-400">Indexing is off: search engines won&apos;t list the site.</span>}
        </div>
      </section>
    </aside>
  );
}
