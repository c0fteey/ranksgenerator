import type { Permission } from "./permissions";

// Site owners: every permission, always. They cannot be edited or removed from the admin panel.
// More owners can be added without a deploy through the OWNER_DISCORD_IDS env var (comma separated).
export const OWNER_IDS: readonly string[] = ["217670555019640832"];

// Accounts granted access in code, no Discord role needed. The admin panel can add more at runtime.
// Example: "123456789012345678": ["generator.use", "history.use"],
export const STATIC_ACCOUNT_GRANTS: Readonly<Record<string, readonly Permission[]>> = {};
