import "server-only";

// Read lazily so a missing variable fails the request that needs it, not the build.
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const optionalEnv = (name: string): string | undefined => process.env[name] || undefined;

export function siteUrl(): string {
  const explicit = optionalEnv("BETTER_AUTH_URL")?.replace(/\/+$/, "");
  const vercel = optionalEnv("VERCEL_PROJECT_PRODUCTION_URL");
  // A localhost URL can't be right on Vercel (e.g. copied from a local .env); Discord would
  // reject it as redirect_uri. Fall back to the production domain there.
  const isLocal = !!explicit && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(explicit);
  if (explicit && !(isLocal && process.env.VERCEL)) return explicit;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}
