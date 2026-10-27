"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { IconButton, Segmented } from "./ui";

export type EditorPage = "icons" | "templates";

const PAGES = {
  icons: { label: "Icons", description: "Draw an icon from scratch or start from a preset, then save it as your own." },
  templates: { label: "Rank templates", description: "Draw a rank template pixel by pixel or start from one of the templates." },
};

export function Editor({
  page,
  onPageChange,
  onClose,
  children,
}: {
  page: EditorPage;
  onPageChange: (page: EditorPage) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the page behind the dialog from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        className="flex max-h-full w-full max-w-lg flex-col gap-5 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-5 sm:max-w-3xl sm:p-6 lg:max-w-5xl lg:p-8 2xl:max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="editor-title" className="text-lg font-semibold">
              Editor
            </h2>
            <p className="text-sm text-muted">{PAGES[page].description}</p>
          </div>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </div>
        <Segmented
          label="Editor page"
          value={page}
          onChange={onPageChange}
          options={Object.entries(PAGES).map(([value, p]) => ({ value: value as EditorPage, label: p.label }))}
        />
        {/* key resets the page's draft when switching */}
        <div key={page} className="flex flex-col gap-5">
          {children}
        </div>
      </div>
    </div>
  );
}
