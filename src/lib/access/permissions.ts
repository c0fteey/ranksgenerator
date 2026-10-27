// Every permission the site checks. Shared by server (enforcement) and client (labels only).
export const PERMISSIONS = {
  "generator.use": { label: "Generator", description: "Use the rank tag generator." },
  "history.use": { label: "History", description: "Open the history page." },
  "admin.access": { label: "Admin panel", description: "Open the admin panel and its activity log." },
  "licenses.manage": { label: "Manage licenses", description: "Create, list and revoke license keys." },
  "access.manage": { label: "Manage access", description: "Assign permissions to Discord roles and accounts." },
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

// What an active license (or a developer seat on one) unlocks.
export const LICENSE_PERMISSIONS: Permission[] = ["generator.use", "history.use"];

export const isPermission = (v: unknown): v is Permission => typeof v === "string" && v in PERMISSIONS;

// Discord snowflake: 17–20 digits.
export const isDiscordId = (v: unknown): v is string => typeof v === "string" && /^\d{17,20}$/.test(v);
