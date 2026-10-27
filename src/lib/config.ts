// Environment variables the site can't run without. Checked by the proxy on every request so a
// missing one shows a setup page instead of crashing each render (see .env.example).
export const REQUIRED_ENV = ["DATABASE_URL", "BETTER_AUTH_SECRET", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"] as const;

export const missingEnv = (): string[] => REQUIRED_ENV.filter((name) => !process.env[name]);
