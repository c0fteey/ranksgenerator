import "server-only";
import { betterAuth } from "better-auth";
import { pool } from "./db";
import { env, siteUrl } from "./env";

// Discord is the only way in. Sessions live in Postgres (no cookie cache), so deleting a
// session row signs that browser out on its next request.
function createAuth() {
  return betterAuth({
    baseURL: siteUrl(),
    secret: env("BETTER_AUTH_SECRET"),
    database: pool(),
    socialProviders: {
      discord: {
        clientId: env("DISCORD_CLIENT_ID"),
        clientSecret: env("DISCORD_CLIENT_SECRET"),
        // Keep name, email and avatar in sync with Discord on every sign-in.
        overrideUserInfoOnSignIn: true,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function auth() {
  instance ??= createAuth();
  return instance;
}
