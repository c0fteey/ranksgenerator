// Per-page link embed text. The default embed image (/api/og) draws these on the themed card.
export const PAGES = {
  home: { path: "/", title: "Generator", description: "Customize your rank tag in real-time and export as PNG." },
  history: { path: "/history", title: "History", description: "Tags you have downloaded." },
  license: { path: "/license", title: "License", description: "Your license details and developer access." },
  admin: { path: "/admin", title: "Admin", description: "Roles, accounts, licenses and site settings." },
  login: { path: "/login", title: "Sign in", description: "The ultimate tool for creating Minecraft rank tags." },
} as const;

export type PageId = keyof typeof PAGES;

export const isPageId = (v: unknown): v is PageId => typeof v === "string" && Object.hasOwn(PAGES, v);
