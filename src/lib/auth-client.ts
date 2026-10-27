"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin client for the Better Auth endpoints under /api/auth.
export const authClient = createAuthClient();
