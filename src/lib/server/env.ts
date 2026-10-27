import "server-only";

// Read lazily so a missing variable fails the request that needs it, not the build.
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const optionalEnv = (name: string): string | undefined => process.env[name] || undefined;

export function siteUrl(): string {
  const explicit = optionalEnv("BETTER_AUTH_URL");
  if (explicit) return explicit;
  const vercel = optionalEnv("VERCEL_PROJECT_PRODUCTION_URL");
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}
